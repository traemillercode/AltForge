import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

export function ensureDbDir(dbPath: string): void {
  const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  if (dir) {
    mkdirSync(dir, { recursive: true });
  }
}

export function initDatabase(dbPath?: string): Database {
  const path = dbPath || process.env.DATABASE_PATH || "./data/altforge.db";
  ensureDbDir(path);
  const database = new Database(path);
  database.run("PRAGMA journal_mode=WAL;");
  database.run("PRAGMA foreign_keys=ON;");
  initializeSchema(database);
  return database;
}

function initializeSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      credits INTEGER DEFAULT 25,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('csv', 'crawl', 'images')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      total_images INTEGER DEFAULT 0,
      processed_images INTEGER DEFAULT 0,
      source_url TEXT,
      source_filename TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      alt_text TEXT,
      char_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'needs_review' CHECK(status IN ('compliant', 'needs_review', 'decorative')),
      context_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_results_job_id ON results(job_id);`);

  // Migration: expand job type check constraint to include 'images'
  // SQLite doesn't support ALTER CHECK, so recreate the constraint via a new table
  const typeConstraint = database
    .query(`SELECT sql FROM sqlite_master WHERE type='table' AND name='jobs'`)
    .get() as { sql: string } | undefined;
  if (typeConstraint && !typeConstraint.sql.includes("'images'")) {
    // Need to rebuild the jobs table with the expanded constraint
    database.run("PRAGMA foreign_keys=OFF;");
    database.run(`
      CREATE TABLE jobs_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('csv', 'crawl', 'images')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        total_images INTEGER DEFAULT 0,
        processed_images INTEGER DEFAULT 0,
        source_url TEXT,
        source_filename TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );
    `);
    database.run(`
      INSERT INTO jobs_new (id, user_id, type, status, total_images, processed_images, source_url, source_filename, created_at, completed_at)
      SELECT id, user_id, type, status, total_images, processed_images, source_url, source_filename, created_at, completed_at
      FROM jobs;
    `);
    database.run("DROP TABLE jobs;");
    database.run("ALTER TABLE jobs_new RENAME TO jobs;");
    database.run("CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);");
    database.run("PRAGMA foreign_keys=ON;");
    console.log("[db] Migrated jobs table to support 'images' job type");
  }
}
