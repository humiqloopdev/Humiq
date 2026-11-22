import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';

/* ── helpers ─────────────────────────────────────────────── */

/** Returns the candidate profile id for a user, creating an empty profile on first use. */
export async function ensureCandidateId(userId) {
  const { rows } = await pool.query(
    `INSERT INTO candidate_profiles (user_id, first_name, last_name)
     SELECT u.id, split_part(u.name, ' ', 1), NULLIF(substr(u.name, length(split_part(u.name, ' ', 1)) + 2), '')
     FROM users u WHERE u.id = $1
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING id`,
    [userId],
  );
  if (!rows[0]) throw new HttpError(404, 'User not found.');
  return rows[0].id;
}

const toNum = (v) => (v === null || v === undefined ? null : Number(v));

/* ── profile ─────────────────────────────────────────────── */

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(30),
  headline: z.string().trim().max(160),
  primaryRole: z.string().trim().min(2).max(100),
  experience: z.string().trim().max(40),
  yearsExperience: z.number().int().min(0).max(60),
  location: z.string().trim().max(120),
  timezone: z.string().trim().max(60),
  availability: z.string().trim().max(60),
  bio: z.string().trim().max(4000),
  onboardingStep: z.number().int().min(1).max(6),
  onboardingCompleted: z.boolean(),
}).partial();

const PROFILE_COLUMNS = {
  firstName: 'first_name', lastName: 'last_name', phone: 'phone', headline: 'headline',
  primaryRole: 'primary_role', experience: 'experience_level', yearsExperience: 'years_experience',
  location: 'location', timezone: 'timezone', availability: 'availability', bio: 'bio',
  onboardingStep: 'onboarding_step', onboardingCompleted: 'onboarding_completed',
};

export async function getProfile(userId) {
  const id = await ensureCandidateId(userId);
  await refreshProfileScore(id);
  const [profile, prefs, skills, certs, resume] = await Promise.all([
    pool.query('SELECT p.*, u.email, u.username FROM candidate_profiles p JOIN users u ON u.id = p.user_id WHERE p.id = $1', [id]),
    pool.query('SELECT * FROM candidate_preferences WHERE candidate_id = $1', [id]),
    pool.query(`SELECT s.name, cs.proficiency, cs.source FROM candidate_skills cs
                JOIN skills s ON s.id = cs.skill_id WHERE cs.candidate_id = $1 ORDER BY s.name`, [id]),
    pool.query('SELECT id, name, issuer, issued_on, expires_on, credential_url FROM candidate_certifications WHERE candidate_id = $1 ORDER BY issued_on DESC NULLS LAST', [id]),
    pool.query(`SELECT id, file_name, version, parse_status, uploaded_at FROM candidate_resumes
                WHERE candidate_id = $1 AND is_current AND deleted_at IS NULL`, [id]),
  ]);
  const p = profile.rows[0];
  const pr = prefs.rows[0];
  return {
    id: p.id, firstName: p.first_name, lastName: p.last_name, email: p.email, username: p.username,
    phone: p.phone, headline: p.headline, primaryRole: p.primary_role, experience: p.experience_level,
    yearsExperience: p.years_experience, location: p.location, timezone: p.timezone,
    availability: p.availability, bio: p.bio, profileScore: p.profile_score,
    onboardingStep: p.onboarding_step, onboardingCompleted: p.onboarding_completed,
    preferences: pr && {
      commitment: pr.commitment, minRate: toNum(pr.min_rate), preferredRate: toNum(pr.preferred_rate),
      timezone: pr.timezone, availability: pr.availability,
    },
    skills: skills.rows,
    certifications: certs.rows,
    resume: resume.rows[0] ?? null,
  };
}

export async function updateProfile(userId, body) {
  const data = parse(profileSchema, body);
  const id = await ensureCandidateId(userId);
  const entries = Object.entries(data).filter(([k]) => PROFILE_COLUMNS[k]);
  if (entries.length) {
    const sets = entries.map(([k], i) => `${PROFILE_COLUMNS[k]} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE candidate_profiles SET ${sets} WHERE id = $1`, [id, ...entries.map(([, v]) => v)]);
  }
  await refreshProfileScore(id);
  return getProfile(userId);
}

/* ── completeness ────────────────────────────────────────── */

async function computeCompleteness(candidateId) {
  const { rows } = await pool.query(
    `SELECT p.first_name, p.last_name, p.phone, p.primary_role, p.experience_level,
            (SELECT COUNT(*) FROM candidate_resumes r WHERE r.candidate_id = p.id AND r.is_current AND r.deleted_at IS NULL) AS resumes,
            (SELECT COUNT(*) FROM candidate_skills s WHERE s.candidate_id = p.id) AS skills,
            (SELECT COUNT(*) FROM candidate_preferences c WHERE c.candidate_id = p.id AND c.min_rate IS NOT NULL) AS prefs,
            (SELECT COUNT(*) FROM candidate_certifications c WHERE c.candidate_id = p.id) AS certs,
            (SELECT COUNT(*) FROM interview_sessions i WHERE i.candidate_id = p.id AND i.status = 'completed') AS interviews
     FROM candidate_profiles p WHERE p.id = $1`, [candidateId]);
  const r = rows[0];
  const items = [
    { key: 'basic', weight: 20, done: !!(r.first_name && r.last_name && r.phone), label: 'Basic details', sub: 'Name and phone number' },
    { key: 'role', weight: 15, done: !!(r.primary_role && r.experience_level), label: 'Role & experience', sub: 'Primary role and experience level' },
    { key: 'resume', weight: 20, done: +r.resumes > 0, label: 'Resume uploaded', sub: 'Upload your latest resume' },
    { key: 'skills', weight: 15, done: +r.skills > 0, label: 'Skills added', sub: 'At least one skill' },
    { key: 'prefs', weight: 10, done: +r.prefs > 0, label: 'Work preferences', sub: 'Rate, commitment and availability' },
    { key: 'certs', weight: 5, done: +r.certs > 0, label: 'Certifications', sub: 'Optional but boosts visibility' },
    { key: 'interview', weight: 15, done: +r.interviews > 0, label: 'AI interview completed', sub: 'Complete one AI interview' },
  ];
  const score = items.reduce((sum, i) => sum + (i.done ? i.weight : 0), 0);
  return { score, checklist: items };
}

export async function refreshProfileScore(candidateId) {
  const { score } = await computeCompleteness(candidateId);
  await pool.query('UPDATE candidate_profiles SET profile_score = $2 WHERE id = $1', [candidateId, score]);
  return score;
}

export async function getProfileCompleteness(userId) {
  const id = await ensureCandidateId(userId);
  const result = await computeCompleteness(id);
  await pool.query('UPDATE candidate_profiles SET profile_score = $2 WHERE id = $1', [id, result.score]);
  return result;
}

/* ── resume ──────────────────────────────────────────────── */

export async function saveResume(userId, file) {
  if (!file) throw new HttpError(400, 'Resume file is required (field name "resume").');
  const candidateId = await ensureCandidateId(userId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE candidate_resumes SET is_current = FALSE WHERE candidate_id = $1 AND is_current', [candidateId]);
    const { rows } = await client.query(
      `INSERT INTO candidate_resumes (candidate_id, file_name, file_path, mime_type, file_size, version)
       VALUES ($1,$2,$3,$4,$5, COALESCE((SELECT MAX(version) FROM candidate_resumes WHERE candidate_id = $1), 0) + 1)
       RETURNING id, file_name, version, parse_status, uploaded_at`,
      [candidateId, file.originalname, file.path, file.mimetype, file.size],
    );
    await client.query('COMMIT');
    await refreshProfileScore(candidateId);
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getParsedResume(userId) {
  const id = await ensureCandidateId(userId);
  const { rows } = await pool.query(
    `SELECT id, file_name, version, parse_status, parsed_data FROM candidate_resumes
     WHERE candidate_id = $1 AND is_current AND deleted_at IS NULL`, [id]);
  if (!rows[0]) throw new HttpError(404, 'No resume uploaded yet.');
  return rows[0];
}

/* ── skills & preferences ────────────────────────────────── */

export async function replaceSkills(userId, body) {
  const { skills } = parse(z.object({ skills: z.array(z.string().trim().min(1).max(80)).max(100) }), body);
  const seen = new Set();
  const names = skills.filter((s) => !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  const candidateId = await ensureCandidateId(userId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM candidate_skills WHERE candidate_id = $1', [candidateId]);
    for (const name of names) {
      const { rows } = await client.query(
        `INSERT INTO skills (name) VALUES ($1)
         ON CONFLICT ((LOWER(name))) DO UPDATE SET name = skills.name RETURNING id`, [name]);
      await client.query('INSERT INTO candidate_skills (candidate_id, skill_id) VALUES ($1,$2)', [candidateId, rows[0].id]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await refreshProfileScore(candidateId);
  return { skills: names };
}

const prefsSchema = z.object({
  commitment: z.string().trim().min(1).max(40),
  minRate: z.number().min(0),
  preferredRate: z.number().min(0),
  timezone: z.string().trim().max(60),
  availability: z.string().trim().max(60),
}).refine((p) => p.preferredRate >= p.minRate, { message: 'Preferred rate must be at least the minimum rate.', path: ['preferredRate'] });

export async function savePreferences(userId, body) {
  const p = parse(prefsSchema, body);
  const candidateId = await ensureCandidateId(userId);
  await pool.query(
    `INSERT INTO candidate_preferences (candidate_id, commitment, min_rate, preferred_rate, timezone, availability)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (candidate_id) DO UPDATE SET commitment = EXCLUDED.commitment, min_rate = EXCLUDED.min_rate,
       preferred_rate = EXCLUDED.preferred_rate, timezone = EXCLUDED.timezone, availability = EXCLUDED.availability`,
    [candidateId, p.commitment, p.minRate, p.preferredRate, p.timezone, p.availability],
  );
  await refreshProfileScore(candidateId);
  return p;
}

/* ── applications ────────────────────────────────────────── */

const WITHDRAWABLE = ['applied', 'in_review', 'shortlisted', 'interview_scheduled', 'interviewed'];

export async function listApplications(userId) {
  const id = await ensureCandidateId(userId);
  const { rows } = await pool.query(
    `SELECT a.id, a.status, a.match_score, a.applied_at, a.status_changed_at,
            j.id AS job_id, j.title, j.company_name
     FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE a.candidate_id = $1 ORDER BY a.applied_at DESC`, [id]);
  return rows;
}

export async function getApplication(userId, applicationId) {
  const id = await ensureCandidateId(userId);
  const { rows } = await pool.query(
    `SELECT a.*, j.title, j.company_name FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE a.id = $1 AND a.candidate_id = $2`, [applicationId, id]);
  if (!rows[0]) throw new HttpError(404, 'Application not found.');
  const history = await pool.query(
    `SELECT from_status, to_status, note, changed_at FROM application_status_history
     WHERE application_id = $1 ORDER BY changed_at`, [applicationId]);
  return { ...rows[0], history: history.rows };
}

export async function withdrawApplication(userId, applicationId) {
  const id = await ensureCandidateId(userId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT status FROM applications WHERE id = $1 AND candidate_id = $2 FOR UPDATE', [applicationId, id]);
    if (!rows[0]) throw new HttpError(404, 'Application not found.');
    if (!WITHDRAWABLE.includes(rows[0].status)) {
      throw new HttpError(409, `An application that is "${rows[0].status}" cannot be withdrawn.`);
    }
    await client.query(`UPDATE applications SET status = 'withdrawn', withdrawn_at = NOW(), status_changed_at = NOW() WHERE id = $1`, [applicationId]);
    await client.query(
      `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, note)
       VALUES ($1,$2,'withdrawn',$3,'Withdrawn by candidate')`, [applicationId, rows[0].status, userId]);
    await client.query('COMMIT');
    return { id: applicationId, status: 'withdrawn' };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ── dashboard & payments ────────────────────────────────── */

export async function getDashboard(userId) {
  const id = await ensureCandidateId(userId);
  const [stats, notes, profile] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM applications WHERE candidate_id = $1 AND status NOT IN ('rejected','withdrawn','accepted')) AS active_applications,
         (SELECT COUNT(*) FROM applications WHERE candidate_id = $1 AND status = 'offer_received') AS offers,
         (SELECT COUNT(*) FROM interview_sessions WHERE candidate_id = $1 AND status = 'scheduled') AS interviews_scheduled,
         (SELECT COUNT(*) FROM interview_sessions WHERE candidate_id = $1 AND status = 'in_progress') AS interviews_pending,
         (SELECT ROUND(AVG(overall_score), 1) FROM interview_sessions WHERE candidate_id = $1 AND overall_score IS NOT NULL) AS avg_ai_score,
         (SELECT COUNT(*) FROM saved_jobs WHERE candidate_id = $1) AS saved_jobs`, [id]),
    pool.query('SELECT id, type, title, body, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8', [userId]),
    pool.query('SELECT profile_score FROM candidate_profiles WHERE id = $1', [id]),
  ]);
  const s = stats.rows[0];
  return {
    profileScore: profile.rows[0].profile_score,
    activeApplications: +s.active_applications, offers: +s.offers,
    interviewsScheduled: +s.interviews_scheduled, interviewsPending: +s.interviews_pending,
    avgAiScore: toNum(s.avg_ai_score), savedJobs: +s.saved_jobs,
    recentActivity: notes.rows,
  };
}

export async function getPayments(userId) {
  const id = await ensureCandidateId(userId);
  const [list, summary, methods] = await Promise.all([
    pool.query(
      `SELECT p.id, p.invoice_number, p.period_start, p.period_end, p.hours, p.gross_amount, p.fee_amount,
              p.net_amount, p.status, p.paid_at, j.company_name AS employer
       FROM payments p JOIN contracts c ON c.id = p.contract_id JOIN jobs j ON j.id = c.job_id
       WHERE p.candidate_id = $1 ORDER BY p.period_end DESC`, [id]),
    pool.query(
      `SELECT COALESCE(SUM(net_amount) FILTER (WHERE status = 'paid'), 0) AS total_earned,
              COALESCE(SUM(net_amount) FILTER (WHERE status = 'processing'), 0) AS pending_payout,
              COALESCE(SUM(gross_amount), 0) AS gross_billed
       FROM payments WHERE candidate_id = $1`, [id]),
    pool.query(`SELECT id, method_type, label, account_last4, is_default FROM payout_methods
                WHERE candidate_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC`, [id]),
  ]);
  const s = summary.rows[0];
  return {
    summary: { totalEarned: +s.total_earned, pendingPayout: +s.pending_payout, grossBilled: +s.gross_billed },
    payoutMethods: methods.rows,
    payments: list.rows.map((r) => ({ ...r, hours: +r.hours, gross_amount: +r.gross_amount, fee_amount: +r.fee_amount, net_amount: +r.net_amount })),
  };
}
