import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'menubar-utility.db');

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations();
}

function runMigrations(): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');

  // In dev mode, migrations are in src; in prod, they're bundled
  const possiblePaths = [
    migrationsDir,
    path.join(__dirname, '..', '..', 'src', 'main', 'db', 'migrations'),
    path.join(process.resourcesPath || '', 'migrations'),
  ];

  let actualMigrationsDir = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      actualMigrationsDir = p;
      break;
    }
  }

  if (!actualMigrationsDir) {
    console.warn('No migrations directory found, skipping migrations');
    return;
  }

  const files = fs.readdirSync(actualMigrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all()
      .map((row: { name: string }) => row.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(actualMigrationsDir, file), 'utf-8');

    const migrate = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    });

    migrate();
    console.log(`Migration applied: ${file}`);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
