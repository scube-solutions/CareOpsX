/**
 * ⛔ LEGACY FILE — Supabase has been fully removed from CareOpsX.
 * This module intentionally throws on import so accidental remaining uses are caught at startup.
 *
 * Use backend/src/utils/db.js (pg Pool) for all database access.
 * Use backend/src/utils/storage.js for file storage (MinIO).
 */
throw new Error(
  '[CareOpsX] supabase.js import detected. Supabase has been removed. ' +
  'Use db.js (pg Pool) for database queries and storage.js for file storage.'
);