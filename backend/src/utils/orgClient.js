const db = require('./db');

/**
 * Returns the PostgreSQL connection pool for the single database architecture.
 * This wrapper maintains compatibility with all controllers importing getDb.
 */
const getDb = async (req) => {
  return db.pool;
};

/**
 * No-op function since there is no cache needed for a single connection pool.
 */
const invalidateOrgCache = (organizationId) => {
  // No-op
};

module.exports = { getDb, invalidateOrgCache, controlPlaneDb: db.pool };
