import crypto from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';
import { audit } from './audit.js';

const profileSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  website: z.string().trim().max(255),
  industry: z.string().trim().max(100),
  headquarters: z.string().trim().max(120),
  size: z.string().trim().max(40),
  description: z.string().trim().max(4000),
  plan: z.enum(['starter', 'pro', 'enterprise']),
  billingEmail: z.string().trim().email().max(150),
}).partial();

const COLUMNS = {
  companyName: 'name', website: 'website', industry: 'industry', headquarters: 'headquarters',
  size: 'size', description: 'description', plan: 'plan', billingEmail: 'billing_email',
};

const shape = (c, role) => c && ({
  id: c.id, companyName: c.name, website: c.website, industry: c.industry, headquarters: c.headquarters,
  size: c.size, description: c.description, plan: c.plan, trialEndsAt: c.trial_ends_at,
  billingEmail: c.billing_email, role,
});

export async function getProfile(userId) {
  const { rows } = await pool.query(
    `SELECT c.*, m.role FROM company_members m JOIN companies c ON c.id = m.company_id AND c.deleted_at IS NULL
     WHERE m.user_id = $1`, [userId]);
  // No company yet (first visit): the frontend onboarding creates it.
  return rows[0] ? shape(rows[0], rows[0].role) : { id: null, role: null };
}

/** Creates the company on first save (the caller becomes its owner), otherwise updates it. */
export async function saveProfile(userId, body) {
  const data = parse(profileSchema, body);
  const existing = await pool.query('SELECT company_id, role FROM company_members WHERE user_id = $1', [userId]);

  if (!existing.rows[0]) {
    if (!data.companyName) throw new HttpError(400, 'Company name is required.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO companies (name, website, industry, headquarters, size, description, plan, billing_email, trial_ends_at)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'starter'),$8, NOW() + INTERVAL '14 days') RETURNING id`,
        [data.companyName, data.website ?? null, data.industry ?? null, data.headquarters ?? null, data.size ?? null,
          data.description ?? null, data.plan ?? null, data.billingEmail ?? null]);
      await client.query(`INSERT INTO company_members (company_id, user_id, role) VALUES ($1,$2,'owner')`, [rows[0].id, userId]);
      await audit({ companyId: rows[0].id, actorId: userId, entityType: 'company', entityId: rows[0].id, action: 'company.created' }, client);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return getProfile(userId);
  }

  const { company_id: companyId, role } = existing.rows[0];
  if (!['owner', 'admin'].includes(role)) throw new HttpError(403, 'Only owners and admins can edit the company profile.');
  if ((data.plan || data.billingEmail) && role !== 'owner') throw new HttpError(403, 'Only the owner can change billing.');
  const entries = Object.entries(data).filter(([k]) => COLUMNS[k]);
  if (entries.length) {
    const sets = entries.map(([k], i) => `${COLUMNS[k]} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE companies SET ${sets} WHERE id = $1`, [companyId, ...entries.map(([, v]) => v)]);
    await audit({ companyId, actorId: userId, entityType: 'company', entityId: companyId, action: 'company.updated', meta: { fields: entries.map(([k]) => k) } });
  }
  return getProfile(userId);
}

/* ── team ────────────────────────────────────────────────── */

export async function getTeam(companyId) {
  const [members, invites] = await Promise.all([
    pool.query(
      `SELECT u.id, u.name, u.email, m.role, m.created_at FROM company_members m
       JOIN users u ON u.id = m.user_id WHERE m.company_id = $1
       ORDER BY CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'recruiter' THEN 3 ELSE 4 END, u.name`, [companyId]),
    pool.query(
      `SELECT id, email, role, expires_at, created_at FROM company_invitations
       WHERE company_id = $1 AND status = 'pending' AND expires_at > NOW() ORDER BY created_at DESC`, [companyId]),
  ]);
  return { members: members.rows, invitations: invites.rows };
}

export async function inviteMember(company, userId, body) {
  const { email, role } = parse(z.object({ email: z.string().trim().toLowerCase().email().max(150), role: z.enum(['admin', 'recruiter', 'viewer']) }), body);
  if (role === 'admin' && company.role !== 'owner') throw new HttpError(403, 'Only the owner can invite admins.');
  if (company.role === 'recruiter' || company.role === 'viewer') throw new HttpError(403, 'Only owners and admins can invite members.');

  const already = await pool.query(
    `SELECT 1 FROM company_members m JOIN users u ON u.id = m.user_id WHERE m.company_id = $1 AND LOWER(u.email) = $2`, [company.id, email]);
  if (already.rowCount) throw new HttpError(409, 'That person is already on your team.');

  const pending = await pool.query(`SELECT 1 FROM company_invitations WHERE company_id = $1 AND LOWER(email) = $2 AND status = 'pending' AND expires_at > NOW()`, [company.id, email]);
  if (pending.rowCount) throw new HttpError(409, 'An invitation is already pending for that email.');

  const token = crypto.randomBytes(24).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  // Replace any expired/old pending invite for the same email.
  await pool.query(`UPDATE company_invitations SET status = 'expired' WHERE company_id = $1 AND LOWER(email) = $2 AND status = 'pending' AND expires_at <= NOW()`, [company.id, email]);
  const { rows } = await pool.query(
    `INSERT INTO company_invitations (company_id, email, role, token_hash, invited_by, expires_at)
     VALUES ($1,$2,$3,$4,$5, NOW() + INTERVAL '7 days') RETURNING id, email, role, expires_at`,
    [company.id, email, role, hash, userId]);
  await audit({ companyId: company.id, actorId: userId, entityType: 'invitation', entityId: rows[0].id, action: 'team.invited', meta: { email, role } });
  // No email service yet: the token is returned once so it can be shared. It is never stored in plain text.
  return { ...rows[0], token };
}

export async function acceptInvitation(userId, body) {
  const { token } = parse(z.object({ token: z.string().min(10) }), body);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = (await pool.query('SELECT email FROM users WHERE id = $1', [userId])).rows[0];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = (await client.query(`SELECT * FROM company_invitations WHERE token_hash = $1 FOR UPDATE`, [hash])).rows[0];
    if (!inv || inv.status !== 'pending' || inv.expires_at < new Date()) throw new HttpError(400, 'This invitation is invalid or has expired.');
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) throw new HttpError(403, 'This invitation was sent to a different email address.');
    const member = await client.query('SELECT 1 FROM company_members WHERE user_id = $1', [userId]);
    if (member.rowCount) throw new HttpError(409, 'You already belong to a company.');
    await client.query('INSERT INTO company_members (company_id, user_id, role) VALUES ($1,$2,$3)', [inv.company_id, userId, inv.role]);
    await client.query(`UPDATE company_invitations SET status = 'accepted' WHERE id = $1`, [inv.id]);
    await audit({ companyId: inv.company_id, actorId: userId, entityType: 'invitation', entityId: inv.id, action: 'team.joined', meta: { role: inv.role } }, client);
    await client.query('COMMIT');
    return { companyId: inv.company_id, role: inv.role };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Removes a member (by user id) or revokes a pending invitation (by invitation id). */
export async function removeTeamEntry(company, userId, id) {
  if (!['owner', 'admin'].includes(company.role)) throw new HttpError(403, 'Only owners and admins can manage the team.');
  const inv = await pool.query(
    `UPDATE company_invitations SET status = 'revoked' WHERE id::text = $1 AND company_id = $2 AND status = 'pending' RETURNING id`, [id, company.id]).catch(() => ({ rowCount: 0 }));
  if (inv.rowCount) {
    await audit({ companyId: company.id, actorId: userId, entityType: 'invitation', entityId: id, action: 'team.invite_revoked' });
    return { removed: 'invitation' };
  }
  const target = (await pool.query('SELECT role FROM company_members WHERE company_id = $1 AND user_id::text = $2', [company.id, id])).rows[0];
  if (!target) throw new HttpError(404, 'Team member not found.');
  if (target.role === 'owner') throw new HttpError(409, 'The owner cannot be removed.');
  if (target.role === 'admin' && company.role !== 'owner') throw new HttpError(403, 'Only the owner can remove admins.');
  await pool.query('DELETE FROM company_members WHERE company_id = $1 AND user_id::text = $2', [company.id, id]);
  await audit({ companyId: company.id, actorId: userId, entityType: 'member', action: 'team.removed', meta: { userId: Number(id) } });
  return { removed: 'member' };
}
