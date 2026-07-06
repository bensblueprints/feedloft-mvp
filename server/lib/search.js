'use strict';

/**
 * Thin wrapper keeping the items_fts index in sync with the items table.
 * We use the item's own integer id as the FTS rowid so we never need a
 * separate mapping table, and index maintenance is just explicit
 * INSERT OR REPLACE / DELETE statements driven by application code
 * (rather than fragile AFTER INSERT/UPDATE/DELETE triggers).
 */
function indexItem(db, item) {
  const text = item.fulltext_html || item.content_html || item.summary || '';
  // FTS5 virtual tables don't support ON CONFLICT/UPSERT, so re-indexing
  // is a plain delete-then-insert (both cheap, and safe to call whether
  // or not a row already exists for this id).
  db.prepare(`DELETE FROM items_fts WHERE rowid = ?`).run(item.id);
  db.prepare(`INSERT INTO items_fts(rowid, title, content) VALUES (?, ?, ?)`).run(
    item.id,
    stripHtml(item.title || ''),
    stripHtml(text)
  );
}

function removeItem(db, itemId) {
  db.prepare(`DELETE FROM items_fts WHERE rowid = ?`).run(itemId);
}

function stripHtml(html) {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Full text search across all items (optionally scoped to a feed).
 */
function search(db, query, { feedId, limit = 50 } = {}) {
  if (!query || !query.trim()) return [];
  const ftsQuery = sanitizeMatchQuery(query);
  if (!ftsQuery) return [];
  const rows = db
    .prepare(
      `SELECT items.*, feeds.title AS feed_title
       FROM items_fts
       JOIN items ON items.id = items_fts.rowid
       JOIN feeds ON feeds.id = items.feed_id
       WHERE items_fts MATCH ?
       ${feedId ? 'AND items.feed_id = ?' : ''}
       ORDER BY rank
       LIMIT ?`
    )
    .all(...(feedId ? [ftsQuery, feedId, limit] : [ftsQuery, limit]));
  return rows;
}

// Escape a raw user query into a safe FTS5 MATCH expression: quote each
// token so punctuation/operators in user input can't break the syntax.
function sanitizeMatchQuery(query) {
  const tokens = query
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter(Boolean);
  if (!tokens.length) return '';
  return tokens.map((t) => `"${t}"*`).join(' ');
}

module.exports = { indexItem, removeItem, search };
