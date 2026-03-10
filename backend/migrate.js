#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATION_TABLE = 'schema_migrations';
const DUPLICATE_OBJECT_ERROR_CODES = new Set([
  '42P07', // duplicate_table
  '42710', // duplicate_object
  '42701', // duplicate_column
  '42P16', // invalid_table_definition (often duplicate constraints/index shape)
]);

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    'postgresql://localhost/construction_db'
  );
}

async function runMigrations() {
  const connectionString = resolveDatabaseUrl();

  if (!connectionString) {
    throw new Error('No database URL found. Set DATABASE_URL or POSTGRES_URL.');
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await client.query(`SELECT name FROM ${MIGRATION_TABLE}`);
    const appliedMigrations = new Set(appliedResult.rows.map((row) => row.name));

    // Read and execute all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`↷ Skipping already applied migration: ${file}`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`Running migration: ${file}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO ${MIGRATION_TABLE} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [file]
        );
        await client.query('COMMIT');
        console.log(`✓ Completed: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');

        if (DUPLICATE_OBJECT_ERROR_CODES.has(error.code)) {
          console.log(`↷ Migration contains existing objects, marking as applied: ${file}`);
          await client.query(
            `INSERT INTO ${MIGRATION_TABLE} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
            [file]
          );
          continue;
        }

        throw error;
      }
    }

    console.log('\n✓ All migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
