const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("WARNING: DATABASE_URL environment variable is not defined!");
}

// SSL is OFF by default so we work with non-SSL internal databases
// (e.g. Coolify's internal PostgreSQL, which does not support SSL).
// Enable SSL only when explicitly requested:
//   - DATABASE_URL contains `sslmode=require` (or verify-*), or
//   - DB_SSL / PGSSL env var is set to a truthy value.
const sslEnv = (process.env.DB_SSL || process.env.PGSSL || '').toLowerCase();
const wantSsl =
  ['true', '1', 'require', 'on'].includes(sslEnv) ||
  /[?&]sslmode=(require|verify-ca|verify-full)/i.test(connectionString || '');

const pool = new Pool({
  connectionString,
  ssl: wantSsl ? { rejectUnauthorized: false } : false
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
