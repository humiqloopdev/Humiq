import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';
import { audit } from './audit.js';
import { revokeAllForUser } from './auth.service.js';

const pct = (now, before) => (before > 0 ? Math.round((100 * (now - before)) / before) : null);
const num = (v) => (v == null ? null : +v);

/* ── overview ────────────────────────────────────────────── */

export async function getOverview() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'candidate' AND status <> 'deleted') AS candidates,
      (SELECT COUNT(*) FROM users WHERE role = 'candidate' AND status <> 'deleted' AND created_at >= NOW() - INTERVAL '7 days') AS new_candidates_7d,
      (SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL) AS employers,
      (SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '30 days') AS new_employers_30d,
      (SELECT COUNT(*) FROM interview_sessions WHERE created_at >= NOW() - INTERVAL '30 days') AS interviews_30d,
      (SELECT COUNT(*) FROM interview_sessions WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS interviews_prev_30d,
      (SELECT COALESCE(SUM(gross_amount), 0) FROM payments WHERE period_end >= CURRENT_DATE - 30) AS gmv_30d,
      (SELECT COALESCE(SUM(gross_amount), 0) FROM payments WHERE period_end >= CURRENT_DATE - 60 AND period_end < CURRENT_DATE - 30) AS gmv_prev_30d,
      (SELECT COUNT(*) FROM jobs WHERE status = 'active' AND deleted_at IS NULL AND moderation_status <> 'removed') AS active_jobs,
      (SELECT COUNT(*) FROM applications) AS applications,
      (SELECT COUNT(*) FROM interview_flags WHERE status = 'open') AS open_flags,
      (SELECT COUNT(*) FROM billing_disputes WHERE status = 'open') AS open_disputes,
      (SELECT COUNT(*) FROM data_deletion_requests WHERE status = 'pending') AS pending_deletions,
      (SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL AND kyc_status = 'pending') AS pending_kyc`);
  const r = rows[0];
  return {
    candidates: +r.candidates, newCandidates7d: +r.new_candidates_7d,
    employers: +r.employers, newEmployers30d: +r.new_employers_30d,
    interviews30d: +r.interviews_30d, interviewsChangePct: pct(+r.interviews_30d, +r.interviews_prev_30d),
    gmv30d: +r.gmv_30d, gmvChangePct: pct(+r.gmv_30d, +r.gmv_prev_30d),
    activeJobs: +r.active_jobs, applications: +r.applications,
    openFlags: +r.open_flags, openDisputes: +r.open_disputes, pendingDeletions: +r.pending_deletions, pendingKyc: +r.pending_kyc,
  };
}

/* ── users ───────────────────────────────────────────────── */

const userQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['candidate', 'employer', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const USER_SELECT = `
  SELECT u.id, u.name, u.username, u.email, u.role, u.status, u.created_at, u.last_login_at,
         (SELECT ROUND(AVG(i.overall_score)) FROM interview_sessions i JOIN candidate_profiles p ON p.id = i.candidate_id
            WHERE p.user_id = u.id AND i.overall_score IS NOT NULL) AS ai_score,
         (SELECT c.name FROM company_members m JOIN companies c ON c.id = m.company_id WHERE m.user_id = u.id) AS company
  FROM users u`;

function userFilter(f) {
  const where = [];
  const params = [];
  if (f.q) { params.push(`%${f.q}%`); where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.username ILIKE $${params.length})`); }
  if (f.role) { params.push(f.role); where.push(`u.role = $${params.length}`); }
  if (f.status) { params.push(f.status); where.push(`u.status = $${params.length}`); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const shapeUser = (r) => ({ ...r, ai_score: num(r.ai_score) });

export async function listUsers(query) {
  const f = parse(userQuery, query);
  const { sql, params } = userFilter(f);
  const total = (await pool.query(`SELECT COUNT(*) FROM users u ${sql}`, params)).rows[0].count;
  const { rows } = await pool.query(
    `${USER_SELECT} ${sql} ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, f.pageSize, (f.page - 1) * f.pageSize]);
  return { total: +total, page: f.page, pageSize: f.pageSize, results: rows.map(shapeUser) };
}

export async function getUser(id) {
  const { rows } = await pool.query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'User not found.');
  const activity = await pool.query(
    `SELECT action, created_at FROM audit_events WHERE actor_user_id = $1 ORDER BY created_at DESC LIMIT 10`, [id]);
  return { ...shapeUser(rows[0]), recentActivity: activity.rows };
}

export async function updateUser(adminId, id, body) {
  const { status } = parse(z.object({ status: z.enum(['active', 'suspended']) }), body);
  if (Number(id) === adminId) throw new HttpError(409, 'You cannot change your own account status.');
  const target = (await pool.query('SELECT role, status FROM users WHERE id = $1', [id])).rows[0];
  if (!target) throw new HttpError(404, 'User not found.');
  if (target.status === 'deleted') throw new HttpError(409, 'This account was deleted and cannot be changed.');
  if (target.role === 'admin') throw new HttpError(403, 'Admin accounts cannot be suspended from here.');
  await pool.query('UPDATE users SET status = $2 WHERE id = $1', [id, status]);
  if (status === 'suspended') await revokeAllForUser(Number(id)); // end their sessions, not just block new requests
  await audit({ companyId: null, actorId: adminId, entityType: 'user', action: `user.${status === 'suspended' ? 'suspended' : 'reactivated'}`, meta: { userId: Number(id) } });
  return getUser(id);
}

export async function exportUsersCsv(query) {
  const f = parse(userQuery.partial({ page: true, pageSize: true }), query);
  const { sql, params } = userFilter(f);
  const { rows } = await pool.query(`${USER_SELECT} ${sql} ORDER BY u.created_at DESC LIMIT 10000`, params);
  // Cells starting with = + - @ are prefixed with a quote so spreadsheets never run them as formulas.
  const cell = (v) => {
    let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const head = ['id', 'name', 'username', 'email', 'role', 'status', 'created_at', 'last_login_at'];
  return [head.join(','), ...rows.map((r) => head.map((h) => cell(r[h])).join(','))].join('\n');
}

/* ── employers ───────────────────────────────────────────── */

const EMPLOYER_SELECT = `
  SELECT c.id, c.name, c.industry, c.headquarters, c.size, c.plan, c.kyc_status, c.kyc_notes, c.kyc_reviewed_at, c.created_at, c.billing_email,
         (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id AND j.status = 'active' AND j.deleted_at IS NULL) AS active_roles,
         (SELECT COUNT(*) FROM company_members m WHERE m.company_id = c.id) AS members
  FROM companies c WHERE c.deleted_at IS NULL`;

const shapeEmployer = (r) => ({ ...r, active_roles: +r.active_roles, members: +r.members });

export async function listEmployers(query) {
  const kyc = z.enum(['pending', 'verified', 'rejected']).optional().parse(query.kyc);
  const q = z.string().trim().max(100).optional().parse(query.q);
  const params = [];
  let extra = '';
  if (kyc) { params.push(kyc); extra += ` AND c.kyc_status = $${params.length}`; }
  if (q) { params.push(`%${q}%`); extra += ` AND c.name ILIKE $${params.length}`; }
  const { rows } = await pool.query(`${EMPLOYER_SELECT}${extra} ORDER BY c.created_at DESC`, params);
  return rows.map(shapeEmployer);
}

export async function getEmployer(id) {
  const { rows } = await pool.query(`${EMPLOYER_SELECT} AND c.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Employer not found.');
  const team = await pool.query(
    `SELECT u.id, u.name, u.email, m.role FROM company_members m JOIN users u ON u.id = m.user_id WHERE m.company_id = $1 ORDER BY m.created_at`, [id]);
  return { ...shapeEmployer(rows[0]), team: team.rows };
}

export async function setKyc(adminId, id, body) {
  const { status, notes } = parse(z.object({ status: z.enum(['pending', 'verified', 'rejected']), notes: z.string().trim().max(500).optional() }), body);
  const { rowCount } = await pool.query(
    `UPDATE companies SET kyc_status = $2, kyc_notes = $3, kyc_reviewed_by = $4, kyc_reviewed_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id, status, notes ?? null, adminId]);
  if (!rowCount) throw new HttpError(404, 'Employer not found.');
  await audit({ companyId: id, actorId: adminId, entityType: 'company', entityId: id, action: `kyc.${status}`, meta: { notes } });
  return getEmployer(id);
}

export async function setPlan(adminId, id, body) {
  const { plan } = parse(z.object({ plan: z.enum(['starter', 'pro', 'enterprise']) }), body);
  const active = await pool.query('SELECT 1 FROM subscription_plans WHERE code = $1 AND is_active', [plan]);
  if (!active.rowCount) throw new HttpError(409, 'That plan is not currently available.');
  const { rowCount } = await pool.query('UPDATE companies SET plan = $2 WHERE id = $1 AND deleted_at IS NULL', [id, plan]);
  if (!rowCount) throw new HttpError(404, 'Employer not found.');
  await audit({ companyId: id, actorId: adminId, entityType: 'company', entityId: id, action: 'plan.changed', meta: { plan } });
  return getEmployer(id);
}

/* ── job moderation ──────────────────────────────────────── */

export async function listJobs(query) {
  const f = parse(z.object({
    status: z.enum(['draft', 'active', 'paused', 'closed']).optional(),
    moderation: z.enum(['approved', 'flagged', 'removed']).optional(),
    q: z.string().trim().max(100).optional(),
  }), query);
  const where = ['j.deleted_at IS NULL'];
  const params = [];
  if (f.status) { params.push(f.status); where.push(`j.status = $${params.length}`); }
  if (f.moderation) { params.push(f.moderation); where.push(`j.moderation_status = $${params.length}`); }
  if (f.q) { params.push(`%${f.q}%`); where.push(`(j.title ILIKE $${params.length} OR j.company_name ILIKE $${params.length})`); }
  const { rows } = await pool.query(
    `SELECT j.id, j.title, j.company_name, j.status, j.moderation_status, j.moderation_note, j.posted_at,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants
     FROM jobs j WHERE ${where.join(' AND ')} ORDER BY j.posted_at DESC LIMIT 500`, params);
  const stats = (await pool.query(
    `SELECT (SELECT COUNT(*) FROM jobs WHERE status = 'active' AND deleted_at IS NULL AND moderation_status <> 'removed') AS active,
            (SELECT COUNT(*) FROM applications) AS applications,
            (SELECT COUNT(*) FROM applications WHERE status = 'accepted' AND status_changed_at >= NOW() - INTERVAL '30 days') AS filled_30d`)).rows[0];
  return {
    stats: { activeListings: +stats.active, totalApplications: +stats.applications, filled30d: +stats.filled_30d },
    jobs: rows.map((r) => ({ ...r, applicants: +r.applicants })),
  };
}

const MODERATION = {
  flag: { moderation: 'flagged' },
  approve: { moderation: 'approved' },
  remove: { moderation: 'removed', close: true },
  restore: { moderation: 'approved', reopen: true },
};

export async function moderateJob(adminId, id, body) {
  const { action, note } = parse(z.object({ action: z.enum(['flag', 'approve', 'remove', 'restore']), note: z.string().trim().max(500).optional() }), body);
  const rule = MODERATION[action];
  const job = (await pool.query('SELECT status, moderation_status, company_id FROM jobs WHERE id = $1 AND deleted_at IS NULL', [id])).rows[0];
  if (!job) throw new HttpError(404, 'Job not found.');
  if (action === 'restore' && job.moderation_status !== 'removed') throw new HttpError(409, 'Only removed jobs can be restored.');
  await pool.query(
    `UPDATE jobs SET moderation_status = $2, moderation_note = $3, moderated_by = $4, moderated_at = NOW(),
       status = CASE WHEN $5::boolean THEN 'closed' WHEN $6::boolean THEN 'paused' ELSE status END WHERE id = $1`,
    [id, rule.moderation, note ?? null, adminId, !!rule.close, !!rule.reopen]);
  await audit({ companyId: job.company_id, actorId: adminId, entityType: 'job', entityId: id, action: `job.moderation.${action}`, meta: { note } });
  return { id, moderation_status: rule.moderation };
}
