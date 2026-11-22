import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';
import { audit } from './audit.js';

const jobSchema = z.object({
  title: z.string().trim().min(2).max(160),
  roleType: z.string().trim().min(2).max(80),
  commitment: z.string().trim().min(1).max(40),
  rateFrom: z.number().min(0),
  rateTo: z.number().min(0),
  skills: z.array(z.string().trim().min(1).max(80)).min(1).max(40),
  experience: z.string().trim().min(1).max(40),
  description: z.string().trim().min(20).max(10000),
  location: z.string().trim().max(120),
  publish: z.boolean(), // true = go live immediately, otherwise saved as a draft
});
const createSchema = jobSchema.partial({ location: true, publish: true })
  .refine((j) => j.rateTo >= j.rateFrom, { message: 'Rate "to" must be at least rate "from".', path: ['rateTo'] });
const updateSchema = jobSchema.partial()
  .refine((j) => j.rateFrom == null || j.rateTo == null || j.rateTo >= j.rateFrom, { message: 'Rate "to" must be at least rate "from".', path: ['rateTo'] });

const COLUMNS = {
  title: 'title', roleType: 'role_type', commitment: 'commitment', rateFrom: 'rate_from', rateTo: 'rate_to',
  experience: 'experience_level', description: 'description', location: 'location',
};

const JOB_SELECT = `
  SELECT j.id, j.title, j.role_type, j.commitment, j.rate_from, j.rate_to, j.experience_level, j.description,
         j.location, j.status, j.posted_at, j.created_at,
         COALESCE((SELECT array_agg(s.name ORDER BY s.name) FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = j.id), '{}') AS skills,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'shortlisted') AS shortlisted,
         (SELECT COUNT(*) FROM job_views v WHERE v.job_id = j.id) AS views
  FROM jobs j`;

const shape = (r) => ({
  ...r, rate_from: r.rate_from == null ? null : +r.rate_from, rate_to: r.rate_to == null ? null : +r.rate_to,
  applicants: +r.applicants, shortlisted: +r.shortlisted, views: +r.views,
});

async function setSkills(client, jobId, names) {
  await client.query('DELETE FROM job_skills WHERE job_id = $1', [jobId]);
  const seen = new Set();
  for (const name of names.filter((n) => !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))) {
    const { rows } = await client.query(
      `INSERT INTO skills (name) VALUES ($1) ON CONFLICT ((LOWER(name))) DO UPDATE SET name = skills.name RETURNING id`, [name]);
    await client.query('INSERT INTO job_skills (job_id, skill_id) VALUES ($1,$2)', [jobId, rows[0].id]);
  }
}

async function ownedJob(companyId, jobId) {
  const { rows } = await pool.query(`${JOB_SELECT} WHERE j.id = $1 AND j.company_id = $2 AND j.deleted_at IS NULL`, [jobId, companyId]);
  if (!rows[0]) throw new HttpError(404, 'Job not found.');
  return rows[0];
}

export async function listJobs(companyId, query) {
  const status = z.enum(['draft', 'active', 'paused', 'closed']).optional().parse(query.status);
  const { rows } = await pool.query(
    `${JOB_SELECT} WHERE j.company_id = $1 AND j.deleted_at IS NULL ${status ? 'AND j.status = $2' : ''}
     ORDER BY j.created_at DESC`, status ? [companyId, status] : [companyId]);
  return rows.map(shape);
}

export async function getJob(companyId, jobId) {
  return shape(await ownedJob(companyId, jobId));
}

export async function createJob(company, userId, body) {
  const j = parse(createSchema, body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const company_ = (await client.query('SELECT name FROM companies WHERE id = $1', [company.id])).rows[0];
    const { rows } = await client.query(
      `INSERT INTO jobs (employer_id, company_id, company_name, title, role_type, commitment, rate_from, rate_to,
                         experience_level, description, location, status, posted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING id`,
      [userId, company.id, company_.name, j.title, j.roleType, j.commitment, j.rateFrom, j.rateTo, j.experience,
        j.description, j.location ?? 'Remote', j.publish ? 'active' : 'draft']);
    await setSkills(client, rows[0].id, j.skills);
    await audit({ companyId: company.id, actorId: userId, entityType: 'job', entityId: rows[0].id, action: 'job.created', meta: { title: j.title, status: j.publish ? 'active' : 'draft' } }, client);
    await client.query('COMMIT');
    return getJob(company.id, rows[0].id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function updateJob(company, userId, jobId, body) {
  const j = parse(updateSchema, body);
  await ownedJob(company.id, jobId);
  const entries = Object.entries(j).filter(([k]) => COLUMNS[k]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (entries.length) {
      const sets = entries.map(([k], i) => `${COLUMNS[k]} = $${i + 2}`).join(', ');
      await client.query(`UPDATE jobs SET ${sets} WHERE id = $1`, [jobId, ...entries.map(([, v]) => v)]);
    }
    if (j.skills) await setSkills(client, jobId, j.skills);
    await audit({ companyId: company.id, actorId: userId, entityType: 'job', entityId: jobId, action: 'job.updated', meta: { fields: Object.keys(j) } }, client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return getJob(company.id, jobId);
}

const TRANSITIONS = {
  activate: { from: ['draft', 'paused'], to: 'active' },
  pause: { from: ['active'], to: 'paused' },
  close: { from: ['draft', 'active', 'paused'], to: 'closed' },
};

export async function changeStatus(company, userId, jobId, action) {
  const rule = TRANSITIONS[action];
  const job = await ownedJob(company.id, jobId);
  if (!rule.from.includes(job.status)) throw new HttpError(409, `A ${job.status} job cannot be ${action}d.`);
  // Publishing a draft sets the posted date; pausing and re-activating keeps the original one.
  await pool.query(`UPDATE jobs SET status = $2, posted_at = CASE WHEN status = 'draft' THEN NOW() ELSE posted_at END WHERE id = $1`, [jobId, rule.to]);
  await audit({ companyId: company.id, actorId: userId, entityType: 'job', entityId: jobId, action: `job.${action}`, meta: { from: job.status, to: rule.to } });
  return getJob(company.id, jobId);
}

export async function deleteJob(company, userId, jobId) {
  const job = await ownedJob(company.id, jobId);
  if (job.status === 'active' && +job.applicants > 0) throw new HttpError(409, 'Close this job before deleting it. It has applicants.');
  await pool.query('UPDATE jobs SET deleted_at = NOW(), status = \'closed\' WHERE id = $1', [jobId]);
  await audit({ companyId: company.id, actorId: userId, entityType: 'job', entityId: jobId, action: 'job.deleted', meta: { title: job.title } });
  return { id: jobId, deleted: true };
}
