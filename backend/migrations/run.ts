import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'miniworld',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('Connected successfully');

    // Simple: SQL file is always in same directory as run.ts
    const migrationPath = join(__dirname, '001_world_state.sql');
    console.log(`Reading migration file: ${migrationPath}`);
   
    const sql = readFileSync(migrationPath, 'utf8');
   
    console.log('Executing migration...');
    await client.query(sql);
   
    console.log('✓ Migration completed successfully');
    console.log('✓ Tables created: world_state, events, sync_status');
    console.log('✓ Indexes created for optimized queries');
    console.log('✓ 100 tiles initialized as unclaimed');
   
    const result = await client.query('SELECT COUNT(*) as count FROM world_state');
    console.log(`✓ Verified: ${result.rows[0].count} tiles in database`);
   
  } catch (error: any) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

// Only run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}