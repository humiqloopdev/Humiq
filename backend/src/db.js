import pg from 'pg';
import 'dotenv/config';

export const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

export const pool = new pg.Pool({ ...dbConfig, database: process.env.DB_NAME });
