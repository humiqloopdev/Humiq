// One-time setup: creates the database, the `users` table and 3 static users.
// Run with: npm run setup-db  (safe to re-run)
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { dbConfig } from './db.js';

const DB_NAME = process.env.DB_NAME;

const STATIC_USERS = [
  { name: 'Admin User', username: 'ADMIN', email: 'admin@talentai.com', password: 'admin123', role: 'admin' },
  { name: 'Acme Corp', username: 'EMPLOYER', email: 'employer@acmecorp.com', password: 'employer123', role: 'employer' },
  { name: 'Arjun Sharma', username: 'CANDIDATE', email: 'arjun@email.com', password: 'candidate123', role: 'candidate' },
];

async function main() {
  // 1. Create the database if it does not exist
  const admin = new pg.Client({ ...dbConfig, database: 'postgres' });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`Created database "${DB_NAME}"`);
  }
  await admin.end();

  // 2. Create the table and seed users
  const db = new pg.Client({ ...dbConfig, database: DB_NAME });
  await db.connect();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(100) NOT NULL,
      username      VARCHAR(50)  UNIQUE,
      email         VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(100) NOT NULL,
      role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin','employer','candidate')),
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE');
  for (const u of STATIC_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await db.query(
      `INSERT INTO users (name, username, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username`,
      [u.name, u.username, u.email, hash, u.role],
    );
  }
  const { rows } = await db.query('SELECT id, name, username, email, role FROM users ORDER BY id');
  console.table(rows);
  await db.end();
}

main().catch((e) => { console.error('Setup failed:', e.message); process.exit(1); });
