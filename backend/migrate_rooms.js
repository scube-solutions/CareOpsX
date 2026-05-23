const { Client } = require('pg');
require('dotenv').config({ path: '../.env.backend' });

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    await client.query(`
      CREATE TABLE IF NOT EXISTS hospital_rooms (
        id              BIGSERIAL PRIMARY KEY,
        room_name       TEXT NOT NULL,
        room_type       TEXT,
        total_beds      INTEGER DEFAULT 1,
        available_beds  INTEGER DEFAULT 1,
        organization_id BIGINT,
        branch_id       BIGINT,
        created_at      TIMESTAMPTZ DEFAULT now(),
        updated_at      TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS room_allocations (
        id              BIGSERIAL PRIMARY KEY,
        room_id         BIGINT REFERENCES hospital_rooms(id),
        patient_id      UUID,
        bed_number      INTEGER,
        admitted_at     TIMESTAMPTZ DEFAULT now(),
        discharged_at   TIMESTAMPTZ,
        organization_id BIGINT,
        created_by      UUID,
        created_at      TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('Migration successful: hospital_rooms and room_allocations created.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
