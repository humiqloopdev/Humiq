import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';

/*
 * Token design
 *  - access token : short-lived JWT (default 15 min), claims { sub, role, typ: 'access' }. Sent as a Bearer header.
 *  - refresh token: random opaque string (default 7 days). Only its SHA-256 hash is stored in refresh_tokens.
 *                   Each use rotates it (the old one is revoked, a new one issued). Presenting an already-used
 *                   token means it was stolen or replayed, so the whole login "family" is revoked.
 */

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);

export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

export const publicUser = ({ id, name, username, email, role }) => ({ id, name, username, email, role });

export function signAccess(user) {
  return jwt.sign({ sub: user.id, role: user.role, typ: 'access' }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

/** Creates and stores a refresh token. Pass `familyId` when rotating so the family stays linked. */
async function issueRefresh(db, userId, userAgent, familyId = crypto.randomUUID()) {
  const token = crypto.randomBytes(48).toString('base64url');
  const { rows } = await db.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, user_agent)
     VALUES ($1,$2,$3, NOW() + ($4 || ' days')::interval, $5) RETURNING id`,
    [userId, familyId, hashToken(token), REFRESH_DAYS, (userAgent || '').slice(0, 200) || null]);
  return { token, id: rows[0].id, familyId };
}

/** Access + refresh pair for a freshly authenticated user. */
export async function startSession(user, userAgent) {
  const refresh = await issueRefresh(pool, user.id, userAgent);
  return { access: signAccess(user), refresh: refresh.token, user: publicUser(user) };
}

async function revokeFamily(db, familyId) {
  await db.query('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1', [familyId]);
}

export async function revokeAllForUser(userId, db = pool) {
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

/** Exchanges a refresh token for a new access token AND a new refresh token (rotation). */
export async function rotate(refreshToken, userAgent) {
  if (typeof refreshToken !== 'string' || refreshToken.length < 20) throw new HttpError(401, 'Invalid or expired refresh token.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query('SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE', [hashToken(refreshToken)])).rows[0];
    if (!row) throw new HttpError(401, 'Invalid or expired refresh token.');

    if (row.revoked_at) {
      // A used token came back: assume theft and end every session that descends from the same login.
      await revokeFamily(client, row.family_id);
      await client.query('COMMIT');
      throw new HttpError(401, 'This session is no longer valid. Please sign in again.');
    }
    if (row.expires_at < new Date()) throw new HttpError(401, 'Invalid or expired refresh token.');

    const user = (await client.query('SELECT * FROM users WHERE id = $1', [row.user_id])).rows[0];
    if (!user || user.status !== 'active') {
      await revokeFamily(client, row.family_id);
      await client.query('COMMIT');
      throw new HttpError(401, 'Invalid or expired refresh token.');
    }

    const next = await issueRefresh(client, user.id, userAgent, row.family_id);
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $2 WHERE id = $1', [row.id, next.id]);
    await client.query('COMMIT');
    return { access: signAccess(user), refresh: next.token };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Ends one login (the family the token belongs to). Always succeeds so it cannot be used to probe tokens. */
export async function logout(refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken) return;
  const row = (await pool.query('SELECT family_id FROM refresh_tokens WHERE token_hash = $1', [hashToken(refreshToken)])).rows[0];
  if (row) await revokeFamily(pool, row.family_id);
}

/* ── login / register ────────────────────────────────────── */

// Compared against when the account does not exist, so a wrong username takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function login(body, userAgent) {
  const { email, username, password } = body ?? {};
  const identity = (username || email || '').toString().trim().toLowerCase();
  if (!identity || !password || typeof password !== 'string') throw new HttpError(400, 'Username and password are required.');

  const user = (await pool.query('SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1', [identity])).rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Invalid username or password.');
  if (user.status !== 'active') throw new HttpError(403, 'This account has been suspended. Contact support.');

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
  // Housekeeping: drop tokens that expired a while ago.
  await pool.query(`DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days'`);
  return startSession(user, userAgent);
}

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(150),
  // bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
  // Admin accounts can never be created by self-registration.
  role: z.enum(['candidate', 'employer']),
});

export async function register(body, userAgent) {
  const data = parse(registerSchema, body);
  const exists = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [data.email]);
  if (exists.rowCount) throw new HttpError(409, 'An account with this email already exists.');
  const hash = await bcrypt.hash(data.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING *`,
    [data.name, data.email, hash, data.role]);
  return startSession(rows[0], userAgent);
}
