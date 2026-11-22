import crypto from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';
import { audit, notify } from './audit.js';
import { getGroup } from './settings.service.js';
import { revokeAllForUser } from './auth.service.js';

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ── flagged interviews ──────────────────────────────────── */

export async function listFlags(query) {
  const status = z.enum(['open', 'resolved', 'dismissed']).default('open').parse(query.status);
  const { rows } = await pool.query(
    `SELECT f.id, f.reason, f.severity, f.details, f.status, f.resolution, f.created_at, f.resolved_at,
            i.id AS session_id, TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS candidate, j.title AS job_title
     FROM interview_flags f JOIN interview_sessions i ON i.id = f.session_id
     JOIN candidate_profiles p ON p.id = i.candidate_id LEFT JOIN jobs j ON j.id = i.job_id
     WHERE f.status = $1 ORDER BY CASE f.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, f.created_at DESC`, [status]);
  return rows;
}

export async function resolveFlag(adminId, id, body) {
  const { resolution, note } = parse(z.object({ resolution: z.enum(['resolved', 'dismissed']), note: z.string().trim().max(500).optional() }), body);
  const { rows } = await pool.query(
    `UPDATE interview_flags SET status = $2, resolution = $3, resolved_by = $4, resolved_at = NOW()
     WHERE id = $1 AND status = 'open' RETURNING id, status`, [id, resolution, note ?? null, adminId]);
  if (!rows[0]) throw new HttpError(409, 'That flag does not exist or was already handled.');
  await audit({ companyId: null, actorId: adminId, entityType: 'interview_flag', entityId: id, action: `flag.${resolution}`, meta: { note } });
  return rows[0];
}

/* ── payroll & billing ───────────────────────────────────── */

export async function getFinance(query) {
  const f = parse(z.object({
    status: z.enum(['processing', 'paid', 'failed', 'refunded']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  }), query);
  const params = [];
  let where = '';
  if (f.status) { params.push(f.status); where = `WHERE p.status = $1`; }
  const { rows } = await pool.query(
    `SELECT p.id, p.invoice_number, p.period_end, p.gross_amount, p.fee_amount, p.net_amount, p.status, p.paid_at,
            j.company_name AS employer, TRIM(CONCAT(cp.first_name, ' ', cp.last_name)) AS candidate,
            EXISTS (SELECT 1 FROM billing_disputes d WHERE d.payment_id = p.id AND d.status = 'open') AS disputed
     FROM payments p JOIN contracts c ON c.id = p.contract_id JOIN jobs j ON j.id = c.job_id
     JOIN candidate_profiles cp ON cp.id = p.candidate_id ${where}
     ORDER BY p.period_end DESC, p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, f.pageSize, (f.page - 1) * f.pageSize]);
  const s = (await pool.query(
    `SELECT COALESCE(SUM(gross_amount) FILTER (WHERE period_end >= CURRENT_DATE - 30), 0) AS gmv_30d,
            COALESCE(SUM(net_amount) FILTER (WHERE status = 'processing'), 0) AS pending_payouts,
            COALESCE(SUM(fee_amount) FILTER (WHERE status = 'paid'), 0) AS fees_collected,
            (SELECT COUNT(*) FROM billing_disputes WHERE status = 'open') AS open_disputes
     FROM payments`)).rows[0];
  return {
    summary: { gmv30d: +s.gmv_30d, pendingPayouts: +s.pending_payouts, feesCollected: +s.fees_collected, openDisputes: +s.open_disputes },
    transactions: rows.map((r) => ({ ...r, gross_amount: +r.gross_amount, fee_amount: +r.fee_amount, net_amount: +r.net_amount })),
  };
}

/**
 * Simulated payroll run: marks every "processing" payment as paid and records the run.
 * No money moves; a real payment provider would be called here.
 */
export async function runPayroll(adminId) {
  return withTx(async (client) => {
    // Payments with an open dispute are held back.
    const { rows } = await client.query(
      `UPDATE payments p SET status = 'paid', paid_at = NOW()
       WHERE p.status = 'processing' AND NOT EXISTS (SELECT 1 FROM billing_disputes d WHERE d.payment_id = p.id AND d.status = 'open')
       RETURNING p.gross_amount, p.net_amount, p.candidate_id`);
    if (!rows.length) throw new HttpError(409, 'There are no payments ready to process.');
    const totalGross = rows.reduce((s, r) => s + +r.gross_amount, 0);
    const totalNet = rows.reduce((s, r) => s + +r.net_amount, 0);
    const run = (await client.query(
      `INSERT INTO payroll_runs (run_by, payments_count, total_gross, total_net) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
      [adminId, rows.length, totalGross, totalNet])).rows[0];
    const users = await client.query('SELECT DISTINCT user_id FROM candidate_profiles WHERE id = ANY($1)', [rows.map((r) => r.candidate_id)]);
    for (const u of users.rows) await notify(u.user_id, 'payment', 'Payment sent', 'A payment was released to you.', client);
    await audit({ companyId: null, actorId: adminId, entityType: 'payroll_run', entityId: run.id, action: 'payroll.run', meta: { payments: rows.length, totalNet } }, client);
    return { id: run.id, payments: rows.length, totalGross, totalNet, simulated: true };
  });
}

export async function listDisputes(query) {
  const status = z.enum(['open', 'refunded', 'rejected']).default('open').parse(query.status);
  const { rows } = await pool.query(
    `SELECT d.id, d.reason, d.status, d.resolution, d.created_at, d.resolved_at, p.invoice_number, p.gross_amount, p.net_amount,
            j.company_name AS employer, TRIM(CONCAT(cp.first_name, ' ', cp.last_name)) AS candidate
     FROM billing_disputes d JOIN payments p ON p.id = d.payment_id JOIN contracts c ON c.id = p.contract_id
     JOIN jobs j ON j.id = c.job_id JOIN candidate_profiles cp ON cp.id = p.candidate_id
     WHERE d.status = $1 ORDER BY d.created_at DESC`, [status]);
  return rows.map((r) => ({ ...r, gross_amount: +r.gross_amount, net_amount: +r.net_amount }));
}

export async function resolveDispute(adminId, id, body) {
  const { resolution, note } = parse(z.object({ resolution: z.enum(['refunded', 'rejected']), note: z.string().trim().max(500).optional() }), body);
  return withTx(async (client) => {
    const d = (await client.query(`SELECT payment_id, status FROM billing_disputes WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!d) throw new HttpError(404, 'Dispute not found.');
    if (d.status !== 'open') throw new HttpError(409, `This dispute was already ${d.status}.`);
    await client.query(`UPDATE billing_disputes SET status = $2, resolution = $3, resolved_by = $4, resolved_at = NOW() WHERE id = $1`, [id, resolution, note ?? null, adminId]);
    if (resolution === 'refunded') await client.query(`UPDATE payments SET status = 'refunded' WHERE id = $1`, [d.payment_id]);
    await audit({ companyId: null, actorId: adminId, entityType: 'billing_dispute', entityId: id, action: `dispute.${resolution}`, meta: { note } }, client);
    return { id, status: resolution };
  });
}

/* ── compliance ──────────────────────────────────────────── */

export async function getCompliance() {
  const interview = await getGroup('interview');
  const s = (await pool.query(
    `SELECT (SELECT COUNT(*) FROM data_deletion_requests WHERE status = 'pending') AS pending,
            (SELECT COUNT(*) FROM data_deletion_requests WHERE status = 'pending' AND due_at < NOW()) AS overdue,
            (SELECT COUNT(*) FROM audit_events) AS audit_events`)).rows[0];
  return {
    summary: { pendingDeletions: +s.pending, overdueDeletions: +s.overdue, auditEvents: +s.audit_events },
    // Only policies the platform actually enforces or records are listed.
    policies: [
      { policy: 'Recording retention', status: `${interview.recordingRetentionDays} days (setting)` },
      { policy: 'Right to erasure', status: '30-day due date tracked per request' },
      { policy: 'Admin action audit trail', status: 'Every admin change is logged' },
      { policy: 'Passwords', status: 'Stored as bcrypt hashes' },
    ],
  };
}

export async function listDeletions(query) {
  const status = z.enum(['pending', 'completed', 'rejected']).default('pending').parse(query.status);
  const { rows } = await pool.query(
    `SELECT r.id, r.status, r.requested_at, r.due_at, r.processed_at, r.notes, u.id AS user_id, u.name, u.email, u.role, (r.due_at < NOW() AND r.status = 'pending') AS overdue
     FROM data_deletion_requests r JOIN users u ON u.id = r.user_id WHERE r.status = $1 ORDER BY r.due_at`, [status]);
  return rows;
}

/** Anonymises the account: personal data is wiped, contracts and payments stay for the accounting record. */
export async function processDeletion(adminId, id) {
  return withTx(async (client) => {
    const r = (await client.query(`SELECT user_id, status FROM data_deletion_requests WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!r) throw new HttpError(404, 'Request not found.');
    if (r.status !== 'pending') throw new HttpError(409, `This request was already ${r.status}.`);
    const user = (await client.query('SELECT role FROM users WHERE id = $1', [r.user_id])).rows[0];
    if (user.role === 'admin') throw new HttpError(409, 'Admin accounts cannot be erased from here.');

    const randomHash = crypto.randomBytes(32).toString('hex'); // not a valid bcrypt hash, so nobody can ever log in
    await client.query(
      `UPDATE users SET name = 'Deleted user', username = NULL, email = $2, password_hash = $3, status = 'deleted' WHERE id = $1`,
      [r.user_id, `deleted-${r.user_id}@deleted.invalid`, randomHash]);
    const profile = (await client.query('SELECT id FROM candidate_profiles WHERE user_id = $1', [r.user_id])).rows[0];
    if (profile) {
      await client.query(
        `UPDATE candidate_profiles SET first_name = NULL, last_name = NULL, phone = NULL, headline = NULL, bio = NULL, location = NULL,
           deleted_at = NOW() WHERE id = $1`, [profile.id]);
      await client.query(`UPDATE candidate_resumes SET deleted_at = NOW(), parsed_data = NULL WHERE candidate_id = $1`, [profile.id]);
      await client.query('DELETE FROM interview_answers WHERE question_id IN (SELECT q.id FROM interview_questions q JOIN interview_sessions s ON s.id = q.session_id WHERE s.candidate_id = $1)', [profile.id]);
      await client.query('DELETE FROM saved_candidates WHERE candidate_id = $1', [profile.id]);
    }
    await revokeAllForUser(r.user_id, client);
    await client.query('DELETE FROM company_members WHERE user_id = $1', [r.user_id]);
    await client.query('DELETE FROM notifications WHERE user_id = $1', [r.user_id]);
    await client.query(`UPDATE data_deletion_requests SET status = 'completed', processed_by = $2, processed_at = NOW() WHERE id = $1`, [id, adminId]);
    await audit({ companyId: null, actorId: adminId, entityType: 'user', action: 'user.anonymised', meta: { userId: r.user_id, requestId: id } }, client);
    return { id, status: 'completed' };
  });
}

export async function listAudit(query) {
  const f = parse(z.object({
    action: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
  }), query);
  const params = [];
  let where = '';
  if (f.action) { params.push(`${f.action}%`); where = `WHERE a.action LIKE $1`; }
  const { rows } = await pool.query(
    `SELECT a.id, a.action, a.entity_type, a.meta, a.created_at, u.name AS actor, c.name AS company
     FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id LEFT JOIN companies c ON c.id = a.company_id ${where}
     ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, f.pageSize, (f.page - 1) * f.pageSize]);
  return rows;
}

/* ── LLM usage ───────────────────────────────────────────── */

export async function getTokenUsage() {
  const llm = await getGroup('llm');
  const [month, byPurpose, byDay] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens, COUNT(*) AS calls FROM llm_usage_log WHERE created_at >= date_trunc('month', NOW())`),
    pool.query(
      `SELECT purpose, SUM(input_tokens + output_tokens) AS tokens, COUNT(*) AS calls FROM llm_usage_log
       WHERE created_at >= date_trunc('month', NOW()) GROUP BY purpose ORDER BY tokens DESC`),
    pool.query(
      `SELECT to_char(date_trunc('day', created_at), 'Mon DD') AS day, SUM(input_tokens + output_tokens) AS tokens FROM llm_usage_log
       WHERE created_at >= NOW() - INTERVAL '14 days' GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)`),
  ]);
  const used = +month.rows[0].tokens;
  return {
    usedThisMonth: used, calls: +month.rows[0].calls, budget: llm.monthlyTokenBudget,
    percentUsed: llm.monthlyTokenBudget ? Math.round((100 * used) / llm.monthlyTokenBudget) : 0,
    byPurpose: byPurpose.rows.map((r) => ({ purpose: r.purpose, tokens: +r.tokens, calls: +r.calls })),
    byDay: byDay.rows.map((r) => ({ day: r.day, tokens: +r.tokens })),
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
  };
}

