// Sample data for the Admin module. Run with: npm run seed:admin  (run "npm run seed" and "npm run seed:employer" first; safe to re-run)
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

async function main() {
  const admin = (await pool.query(`SELECT id FROM users WHERE username = 'ADMIN'`)).rows[0];
  if (!admin) throw new Error('Run "npm run setup-db" first (ADMIN user missing).');
  if ((await pool.query(`SELECT 1 FROM users WHERE username = 'DELETEME1'`)).rowCount) {
    console.log('Admin sample data already present - nothing to do.');
    return pool.end();
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = bcrypt.hashSync('candidate123', 10);
    const addUser = async (name, username, email, status = 'active') =>
      (await client.query(`INSERT INTO users (name, username, email, password_hash, role, status) VALUES ($1,$2,$3,$4,'candidate',$5) RETURNING id`, [name, username, email, hash, status])).rows[0].id;

    /* Employer KYC */
    await client.query(`UPDATE companies SET kyc_status = 'verified', kyc_reviewed_by = $1, kyc_reviewed_at = NOW() - INTERVAL '20 days' WHERE name = 'Acme Corp'`, [admin.id]);

    /* Flags on existing interviews */
    const sessions = (await client.query(
      `SELECT i.id FROM interview_sessions i WHERE i.status = 'completed' ORDER BY i.created_at LIMIT 2`)).rows;
    if (sessions[0]) await client.query(`INSERT INTO interview_flags (session_id, reason, severity, details) VALUES ($1,'ai_assisted','high','Answers were pasted in under two seconds and match a common online answer.')`, [sessions[0].id]);
    if (sessions[1]) await client.query(`INSERT INTO interview_flags (session_id, reason, severity, details) VALUES ($1,'technical_failure','medium','Connection dropped three times during the interview.')`, [sessions[1].id]);

    /* Dispute on a processing payment */
    const pay = (await client.query(`SELECT id FROM payments WHERE status = 'processing' ORDER BY created_at LIMIT 1`)).rows[0];
    if (pay) await client.query(`INSERT INTO billing_disputes (payment_id, raised_by, reason) VALUES ($1,$2,'Hours billed do not match the timesheet the employer approved.')`, [pay.id, admin.id]);

    /* Users: one suspended, two with pending erasure requests */
    await addUser('Suspended Demo', 'SUSPENDED1', 'suspended.demo@example.com', 'suspended');
    for (const [n, d] of [[1, 28], [2, 5]]) {
      const id = await addUser(`Erasure Demo ${n}`, `DELETEME${n}`, `erasure.demo${n}@example.com`);
      const pid = (await client.query(`INSERT INTO candidate_profiles (user_id, first_name, last_name, phone, headline, location) VALUES ($1,'Erasure',$2,'+91 90000 1111','Demo account','Chennai') RETURNING id`, [id, `Demo${n}`])).rows[0].id;
      await client.query(`INSERT INTO notifications (user_id, type, title) VALUES ($1,'system','Welcome')`, [id]);
      await client.query(
        `INSERT INTO data_deletion_requests (user_id, requested_at, due_at) VALUES ($1, NOW() - ($2 || ' days')::interval, NOW() - ($2 || ' days')::interval + INTERVAL '30 days')`, [id, d]);
      void pid;
    }

    /* LLM usage for the last 14 days (example numbers) */
    await client.query(
      `INSERT INTO llm_usage_log (model, purpose, input_tokens, output_tokens, created_at)
       SELECT 'gemini-3.1-flash-lite', CASE WHEN g % 3 = 0 THEN 'interview_scoring' ELSE 'question_generation' END,
              1800 + (g * 137) % 900, 400 + (g * 53) % 300, NOW() - (g || ' hours')::interval * 3
       FROM generate_series(1, 90) g`);

    await client.query(
      `INSERT INTO audit_events (company_id, actor_user_id, entity_type, action, meta) VALUES (NULL,$1,'settings','settings.platform.updated','{"fields":["commissionPercent"]}')`, [admin.id]);

    await client.query('COMMIT');
    console.log('Admin sample data created.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
