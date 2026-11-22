import { pool } from '../db.js';
import { HttpError } from './errors.js';

const RANK = { viewer: 1, recruiter: 2, admin: 3, owner: 4 };

/**
 * Loads the caller's company and role into req.company, then enforces a minimum role.
 * Every employer query is scoped by req.company.id, so one company can never see another's data.
 */
export const requireCompany = (minRole = 'viewer') => async (req, _res, next) => {
  const { rows } = await pool.query(
    `SELECT m.company_id AS id, m.role FROM company_members m
     JOIN companies c ON c.id = m.company_id AND c.deleted_at IS NULL
     WHERE m.user_id = $1`, [req.auth.sub]);
  if (!rows[0]) throw new HttpError(409, 'Set up your company profile first.');
  if (RANK[rows[0].role] < RANK[minRole]) throw new HttpError(403, `This action needs the "${minRole}" role or higher.`);
  req.company = rows[0];
  next();
};
