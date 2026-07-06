'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

/**
 * Open (and if necessary create/migrate) the Feedloft sqlite database.
 * @param {string} dbPath absolute path to the sqlite file
 */
function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
      url TEXT NOT NULL UNIQUE,
      title TEXT,
      site_url TEXT,
      etag TEXT,
      last_modified TEXT,
      last_polled_at TEXT,
      poll_minutes INTEGER,
      fulltext_always INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      guid TEXT NOT NULL,
      url TEXT,
      title TEXT,
      author TEXT,
      content_html TEXT,
      fulltext_html TEXT,
      summary TEXT,
      published_at TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      starred INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(feed_id, guid)
    );

    CREATE INDEX IF NOT EXISTS idx_items_feed ON items(feed_id);
    CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at);
    CREATE INDEX IF NOT EXISTS idx_items_read ON items(read);
    CREATE INDEX IF NOT EXISTS idx_items_starred ON items(starred);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Plain (non external-content) FTS5 index. We manage rows explicitly
    -- from application code (server/lib/search.js), using each item's own
    -- integer id as the FTS rowid. This deliberately avoids the classic
    -- "external content + contentless_delete" trigger pitfalls: there is
    -- no dependency between this table's lifecycle and the items table's
    -- storage, so deletes/updates are simple explicit statements.
    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
      title,
      content,
      tokenize = 'porter'
    );
  `);
}

module.exports = { openDb };
