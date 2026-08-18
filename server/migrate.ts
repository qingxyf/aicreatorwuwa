import { readFile } from 'node:fs/promises';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const sql = await readFile(new URL('./migrations/001_init.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('database migration complete');
} finally {
  await pool.end();
}
