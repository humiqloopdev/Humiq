import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';
import { ensureCandidateId } from './candidate.service.js';

// Match score = % of the job's required skills the candidate has (0 when the job lists no skills).
const MATCH_SQL = `
  COALESCE(ROUND(100.0 * (SELECT COUNT(*) FROM job_skills js JOIN candidate_skills cs
                           ON cs.skill_id = js.skill_id AND cs.candidate_id = $1 WHERE js.job_id = j.id)
           / NULLIF((SELECT COUNT(*) FROM job_skills js WHERE js.job_id = j.id), 0)), 0)::int`;

const JOB_SELECT = `
  SELECT j.id, j.title, j.company_name, j.description, j.role_type, j.commitment, j.rate_from, j.rate_to,
         j.location, j.experience_level, j.posted_at,
         ${MATCH_SQL} AS match_score,
         COALESCE((SELECT array_agg(s.name ORDER BY s.name) FROM job_skills js JOIN skills s ON s.id = js.skill_id
                   WHERE js.job_id = j.id), '{}') AS skills,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants,
         EXISTS (SELECT 1 FROM saved_jobs sj WHERE sj.job_id = j.id AND sj.candidate_id = $1) AS is_saved,
         (SELECT a.status FROM applications a WHERE a.job_id = j.id AND a.candidate_id = $1) AS application_status
  FROM jobs j`;

const shape = (r) => ({ ...r, rate_from: r.rate_from && +r.rate_from, rate_to: r.rate_to && +r.rate_to, applicants: +r.applicants });

const searchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  skills: z.string().optional(), // comma separated
  commitment: z.string().trim().optional(),
  minRate: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export async function searchJobs(userId, query) {
  const f = parse(searchSchema, query);
  const candidateId = await ensureCandidateId(userId);
  const where = [`j.status = 'active'`, 'j.deleted_at IS NULL'];
  const params = [candidateId];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

  if (f.q) {
    params.push(`%${f.q}%`);
    const n = params.length;
    where.push(`(j.title ILIKE $${n} OR j.company_name ILIKE $${n} OR j.description ILIKE $${n})`);
  }
  if (f.commitment) add('j.commitment = ?', f.commitment);
  if (f.minRate) add('j.rate_to >= ?', f.minRate);
  if (f.skills) {
    const names = f.skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (names.length) add(`EXISTS (SELECT 1 FROM job_skills js JOIN skills s ON s.id = js.skill_id
                                   WHERE js.job_id = j.id AND LOWER(s.name) = ANY(?))`, names);
  }
  params.push(f.pageSize, (f.page - 1) * f.pageSize);
  const { rows } = await pool.query(
    `${JOB_SELECT} WHERE ${where.join(' AND ')} ORDER BY match_score DESC, j.posted_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { page: f.page, pageSize: f.pageSize, results: rows.map(shape) };
}

export async function recommendedJobs(userId) {
  const candidateId = await ensureCandidateId(userId);
  const { rows } = await pool.query(
    `${JOB_SELECT} WHERE j.status = 'active' AND j.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.candidate_id = $1)
     ORDER BY match_score DESC, j.posted_at DESC LIMIT 10`, [candidateId]);
  return rows.map(shape);
}

export async function getJob(userId, jobId) {
  const candidateId = await ensureCandidateId(userId);
  const { rows } = await pool.query(`${JOB_SELECT} WHERE j.id = $2 AND j.deleted_at IS NULL`, [candidateId, jobId]);
  if (!rows[0]) throw new HttpError(404, 'Job not found.');
  await pool.query('INSERT INTO job_views (job_id, candidate_id) VALUES ($1,$2)', [jobId, candidateId]); // feeds employer analytics
  return shape(rows[0]);
}

export async function applyToJob(userId, jobId) {
  const candidateId = await ensureCandidateId(userId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const job = await client.query(`SELECT id, status FROM jobs WHERE id = $1 AND deleted_at IS NULL`, [jobId]);
    if (!job.rows[0]) throw new HttpError(404, 'Job not found.');
    if (job.rows[0].status !== 'active') throw new HttpError(409, 'This job is not accepting applications.');

    const dup = await client.query('SELECT 1 FROM applications WHERE candidate_id = $1 AND job_id = $2', [candidateId, jobId]);
    if (dup.rowCount) throw new HttpError(409, 'You have already applied to this job.');

    const score = await client.query(`SELECT ${MATCH_SQL} AS s FROM jobs j WHERE j.id = $2`, [candidateId, jobId]);
    const { rows } = await client.query(
      `INSERT INTO applications (candidate_id, job_id, match_score) VALUES ($1,$2,$3)
       RETURNING id, status, match_score, applied_at`, [candidateId, jobId, score.rows[0].s]);
    await client.query(
      `INSERT INTO application_status_history (application_id, to_status, changed_by, note)
       VALUES ($1,'applied',$2,'Application submitted')`, [rows[0].id, userId]);
    await client.query('DELETE FROM saved_jobs WHERE candidate_id = $1 AND job_id = $2', [candidateId, jobId]);
    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function saveJob(userId, jobId) {
  const candidateId = await ensureCandidateId(userId);
  const job = await pool.query('SELECT 1 FROM jobs WHERE id = $1 AND deleted_at IS NULL', [jobId]);
  if (!job.rowCount) throw new HttpError(404, 'Job not found.');
  await pool.query('INSERT INTO saved_jobs (candidate_id, job_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [candidateId, jobId]);
  return { jobId, saved: true };
}

export async function unsaveJob(userId, jobId) {
  const candidateId = await ensureCandidateId(userId);
  await pool.query('DELETE FROM saved_jobs WHERE candidate_id = $1 AND job_id = $2', [candidateId, jobId]);
  return { jobId, saved: false };
}

export async function listSavedJobs(userId) {
  const candidateId = await ensureCandidateId(userId);
  const { rows } = await pool.query(
    `${JOB_SELECT} JOIN saved_jobs sv ON sv.job_id = j.id AND sv.candidate_id = $1
     WHERE j.deleted_at IS NULL ORDER BY sv.saved_at DESC`, [candidateId]);
  return rows.map(shape);
}
