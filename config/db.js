const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "database.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS galleries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    client_name TEXT,
    description TEXT,
    share_token TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    gallery_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    size INTEGER,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE
  )
`,
).run();

const galleryColumns = db.prepare("PRAGMA table_info(galleries)").all();

const hasShareToken = galleryColumns.some((col) => col.name === "share_token");
const hasPasswordHash = galleryColumns.some(
  (col) => col.name === "password_hash",
);
const hasExpiresAt = galleryColumns.some((col) => col.name === "expires_at");

if (!hasShareToken) {
  db.prepare(
    `
    ALTER TABLE galleries
    ADD COLUMN share_token TEXT
  `,
  ).run();

  const rowsWithoutToken = db
    .prepare("SELECT id FROM galleries WHERE share_token IS NULL")
    .all();

  const updateTokenStmt = db.prepare(`
    UPDATE galleries
    SET share_token = ?
    WHERE id = ?
  `);

  for (const row of rowsWithoutToken) {
    updateTokenStmt.run(uuidv4(), row.id);
  }

  db.prepare(
    `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_galleries_share_token
    ON galleries(share_token)
  `,
  ).run();
}

if (!hasPasswordHash) {
  db.prepare(
    `
    ALTER TABLE galleries
    ADD COLUMN password_hash TEXT
  `,
  ).run();
}

if (!hasExpiresAt) {
  db.prepare(
    `
    ALTER TABLE galleries
    ADD COLUMN expires_at TEXT
  `,
  ).run();
}

module.exports = db;
