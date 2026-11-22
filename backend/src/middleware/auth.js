import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

/**
 * Verifies the token, then re-checks the account in the database so that a suspended user is blocked
 * immediately and a role change takes effect without waiting for the token to expire.
 */
export async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.typ !== 'access') throw new Error('not an access token');
  } catch {
    return res.status(401).json({ detail: 'Invalid or expired token.' });
  }
  const { rows } = await pool.query('SELECT role, status FROM users WHERE id = $1', [payload.sub]);
  if (!rows[0]) return res.status(401).json({ detail: 'Invalid or expired token.' });
  if (rows[0].status !== 'active') return res.status(403).json({ detail: 'This account has been suspended.' });
  req.auth = { sub: payload.sub, role: rows[0].role };
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.auth?.role) ? next() : res.status(403).json({ detail: 'You do not have access to this resource.' });
