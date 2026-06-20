const fs = require('fs');

/**
 * Resolve the `ssl` option for a pg Pool/Client from the environment.
 *
 * Behaviour (precedence high -> low):
 *   1. Explicit opt-out  -> SSL off
 *        DB_SSL/PGSSL in {false,0,off,disable,disabled}  OR  sslmode=disable
 *   2. Verified TLS      -> SSL on, certificate VERIFIED (rejectUnauthorized: true)
 *        DB_SSL/PGSSL in {verify,verify-ca,verify-full}  OR  sslmode=verify-ca|verify-full
 *        CA bundle taken from DB_SSL_CA (PEM string) or PGSSLROOTCERT (file path).
 *   3. Encrypted TLS     -> SSL on, NOT verified (rejectUnauthorized: false)
 *        DB_SSL/PGSSL in {true,1,require,on}  OR  sslmode=require
 *   4. Default           -> SSL off
 *        Required for non-SSL internal databases (e.g. Coolify internal
 *        PostgreSQL, which is not built with SSL support). A warning is logged
 *        in production so an accidental cleartext connection is visible.
 *
 * @param {string} connectionString  the DATABASE_URL
 * @returns {false | { rejectUnauthorized: boolean, ca?: string }}
 */
function resolveSslConfig(connectionString) {
  const url = connectionString || '';
  const sslEnv = (process.env.DB_SSL || process.env.PGSSL || '').trim().toLowerCase();
  const sslmodeMatch = url.match(/[?&]sslmode=([a-z-]+)/i);
  const sslmode = sslmodeMatch ? sslmodeMatch[1].toLowerCase() : '';

  // 1. Explicit opt-out
  if (['false', '0', 'off', 'disable', 'disabled'].includes(sslEnv) || sslmode === 'disable') {
    return false;
  }

  // 2. Verified TLS (do NOT silently downgrade verify-* to no-verify)
  if (['verify', 'verify-ca', 'verify-full'].includes(sslEnv) ||
      ['verify-ca', 'verify-full'].includes(sslmode)) {
    let ca;
    if (process.env.DB_SSL_CA) {
      ca = process.env.DB_SSL_CA;
    } else if (process.env.PGSSLROOTCERT) {
      ca = fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8');
    }
    return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
  }

  // 3. Encrypted but unverified TLS
  if (['true', '1', 'require', 'on'].includes(sslEnv) || sslmode === 'require') {
    return { rejectUnauthorized: false };
  }

  // 4. Default: no SSL
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      'WARNING: connecting to PostgreSQL WITHOUT TLS. If the database supports SSL, ' +
      'set DB_SSL=require (encrypted) or DB_SSL=verify-full + PGSSLROOTCERT (verified).'
    );
  }
  return false;
}

module.exports = { resolveSslConfig };
