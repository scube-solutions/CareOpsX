const { Pool } = require('pg');
require('dotenv').config();
const { resolveSslConfig } = require('./dbSsl');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("WARNING: DATABASE_URL environment variable is not defined!");
}

// SSL is resolved from the environment. Default is OFF so non-SSL internal
// databases work (e.g. Coolify internal PostgreSQL has no SSL support), but
// verified TLS (verify-full + CA) is fully supported for external databases.
const pool = new Pool({
  connectionString,
  ssl: resolveSslConfig(connectionString)
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
