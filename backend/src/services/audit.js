import { pool } from '../db.js';

/** Records who did what. Pass a transaction client so the entry commits with the change itself. */
export function audit({ companyId, actorId, entityType, entityId = null, action, meta = null }, db = pool) {
  return db.query(
    `INSERT INTO audit_events (company_id, actor_user_id, entity_type, entity_id, action, meta)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [companyId, actorId, entityType, entityId, action, meta]);
}

export function notify(userId, type, title, body, db = pool) {
  return db.query('INSERT INTO notifications (user_id, type, title, body) VALUES ($1,$2,$3,$4)', [userId, type, title, body]);
}
