import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';
import { audit } from './audit.js';

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'with', 'in', 'for', 'of', 'to', 'who', 'is', 'are', 'has', 'have', 'years', 'year', 'experience', 'developer', 'engineer', 'looking', 'need', 'find', 'me']);

const CARD_SELECT = `
  SELECT p.id, p.first_name, p.last_name, p.primary_role, p.headline, p.experience_level, p.years_experience,
         p.location, p.availability,
         COALESCE((SELECT array_agg(s.name ORDER BY s.name) FROM candidate_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.candidate_id = p.id), '{}') AS skills,
         (SELECT ROUND(AVG(i.overall_score)) FROM interview_sessions i WHERE i.candidate_id = p.id AND i.overall_score IS NOT NULL) AS ai_score,
         pr.min_rate, pr.preferred_rate,
         EXISTS (SELECT 1 FROM saved_candidates sc WHERE sc.candidate_id = p.id AND sc.company_id = $1) AS is_saved
  FROM candidate_profiles p
  LEFT JOIN candidate_preferences pr ON pr.candidate_id = p.id`;

const shape = (r) => ({
  id: r.id, name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Candidate',
  role: r.primary_role, headline: r.headline, experience: r.experience_level, yearsExperience: r.years_experience,
  location: r.location, availability: r.availability, skills: r.skills,
  aiScore: r.ai_score == null ? null : +r.ai_score,
  rate: r.min_rate == null ? null : { min: +r.min_rate, preferred: r.preferred_rate == null ? null : +r.preferred_rate },
  isSaved: r.is_saved,
});

const poolSchema = z.object({
  q: z.string().trim().max(100).optional(),
  skills: z.string().optional(), // comma separated
  minScore: z.coerce.number().min(0).max(100).optional(),
  savedOnly: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export async function getPool(companyId, query) {
  const f = parse(poolSchema, query);
  const where = ['p.deleted_at IS NULL', 'p.first_name IS NOT NULL'];
  const params = [companyId];
  if (f.q) {
    params.push(`%${f.q}%`);
    const n = params.length;
    where.push(`(p.first_name ILIKE $${n} OR p.last_name ILIKE $${n} OR p.primary_role ILIKE $${n} OR p.headline ILIKE $${n})`);
  }
  if (f.skills) {
    const names = f.skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (names.length) {
      params.push(names);
      where.push(`NOT EXISTS (SELECT 1 FROM unnest($${params.length}::text[]) want(name)
                   WHERE NOT EXISTS (SELECT 1 FROM candidate_skills cs JOIN skills s ON s.id = cs.skill_id
                                     WHERE cs.candidate_id = p.id AND LOWER(s.name) = want.name))`);
    }
  }
  if (f.minScore != null) {
    params.push(f.minScore);
    where.push(`(SELECT AVG(i.overall_score) FROM interview_sessions i WHERE i.candidate_id = p.id AND i.overall_score IS NOT NULL) >= $${params.length}`);
  }
  if (f.savedOnly === 'true') where.push('EXISTS (SELECT 1 FROM saved_candidates sc WHERE sc.candidate_id = p.id AND sc.company_id = $1)');
  params.push(f.pageSize, (f.page - 1) * f.pageSize);
  const { rows } = await pool.query(
    `${CARD_SELECT} WHERE ${where.join(' AND ')} ORDER BY ai_score DESC NULLS LAST, p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { page: f.page, pageSize: f.pageSize, results: rows.map(shape) };
}

export async function getCandidate(companyId, candidateId) {
  const { rows } = await pool.query(`${CARD_SELECT} WHERE p.id = $2 AND p.deleted_at IS NULL`, [companyId, candidateId]);
  if (!rows[0]) throw new HttpError(404, 'Candidate not found.');
  const [full, certs, scores] = await Promise.all([
    pool.query('SELECT bio FROM candidate_profiles WHERE id = $1', [candidateId]),
    pool.query('SELECT name, issuer FROM candidate_certifications WHERE candidate_id = $1', [candidateId]),
    pool.query(
      `SELECT s.category, ROUND(AVG(s.score)) AS score FROM interview_scores s
       JOIN interview_sessions i ON i.id = s.session_id WHERE i.candidate_id = $1 GROUP BY s.category ORDER BY s.category`, [candidateId]),
  ]);
  // Contact details stay hidden until the candidate has applied to, or been shortlisted by, this company.
  return {
    ...shape(rows[0]), bio: full.rows[0].bio, certifications: certs.rows,
    interviewScores: scores.rows.map((r) => ({ category: r.category, score: +r.score })),
  };
}

export async function saveCandidate(company, userId, candidateId, note) {
  const cand = await pool.query('SELECT 1 FROM candidate_profiles WHERE id = $1 AND deleted_at IS NULL', [candidateId]);
  if (!cand.rowCount) throw new HttpError(404, 'Candidate not found.');
  await pool.query(
    `INSERT INTO saved_candidates (company_id, candidate_id, saved_by, note) VALUES ($1,$2,$3,$4)
     ON CONFLICT (company_id, candidate_id) DO UPDATE SET note = COALESCE(EXCLUDED.note, saved_candidates.note)`,
    [company.id, candidateId, userId, note ?? null]);
  await audit({ companyId: company.id, actorId: userId, entityType: 'candidate', entityId: candidateId, action: 'candidate.saved' });
  return { candidateId, saved: true };
}

export async function unsaveCandidate(company, userId, candidateId) {
  await pool.query('DELETE FROM saved_candidates WHERE company_id = $1 AND candidate_id = $2', [company.id, candidateId]);
  return { candidateId, saved: false };
}

/**
 * Keyword search for now: words in the query are matched against skill names, role and headline.
 * Results are ranked by how many query terms matched. An LLM-powered version can replace this later.
 */
export async function aiSearch(companyId, body) {
  const { query } = parse(z.object({ query: z.string().trim().min(2).max(300) }), body);
  const terms = [...new Set(query.toLowerCase().split(/[^a-z0-9+#.]+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t)))];
  if (!terms.length) throw new HttpError(400, 'Describe the skills or role you are looking for.');
  const { rows } = await pool.query(
    `SELECT c.*, (SELECT COUNT(*) FROM unnest($2::text[]) t WHERE
              EXISTS (SELECT 1 FROM candidate_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.candidate_id = c.id AND LOWER(s.name) = t)
           OR LOWER(COALESCE(c.primary_role,'') || ' ' || COALESCE(c.headline,'')) LIKE '%' || t || '%') AS hits
     FROM (${CARD_SELECT} WHERE p.deleted_at IS NULL AND p.first_name IS NOT NULL) c
     WHERE (SELECT COUNT(*) FROM unnest($2::text[]) t WHERE
              EXISTS (SELECT 1 FROM candidate_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.candidate_id = c.id AND LOWER(s.name) = t)
           OR LOWER(COALESCE(c.primary_role,'') || ' ' || COALESCE(c.headline,'')) LIKE '%' || t || '%') > 0
     ORDER BY hits DESC, ai_score DESC NULLS LAST LIMIT 20`, [companyId, terms]);
  return {
    query, terms,
    results: rows.map((r) => ({
      ...shape(r), matchScore: Math.round((100 * +r.hits) / terms.length),
      matchedSkills: r.skills.filter((s) => terms.includes(s.toLowerCase())),
    })),
  };
}
