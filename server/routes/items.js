'use strict';

const express = require('express');
const { extractFullText } = require('../lib/fulltext');
const { indexItem } = require('../lib/search');

function buildItemsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { feed, folder, unread, starred, before, limit } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 200);

    const clauses = [];
    const params = {};

    if (feed) {
      clauses.push('items.feed_id = @feed');
      params.feed = Number(feed);
    }
    if (folder) {
      clauses.push('items.feed_id IN (SELECT id FROM feeds WHERE folder_id = @folder)');
      params.folder = Number(folder);
    }
    if (unread === '1') clauses.push('items.read = 0');
    if (starred === '1') clauses.push('items.starred = 1');
    if (before) {
      clauses.push('items.id < @before');
      params.before = Number(before);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT items.*, feeds.title AS feed_title FROM items
         JOIN feeds ON feeds.id = items.feed_id
         ${where}
         ORDER BY items.published_at DESC, items.id DESC
         LIMIT @take`
      )
      .all({ ...params, take });

    res.json(rows);
  });

  router.get('/:id', (req, res) => {
    const item = db
      .prepare('SELECT items.*, feeds.title AS feed_title FROM items JOIN feeds ON feeds.id = items.feed_id WHERE items.id = ?')
      .get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  });

  router.put('/:id', (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const { read, starred } = req.body || {};
    db.prepare('UPDATE items SET read = ?, starred = ? WHERE id = ?').run(
      read != null ? (read ? 1 : 0) : item.read,
      starred != null ? (starred ? 1 : 0) : item.starred,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id));
  });

  router.post('/mark-read', (req, res) => {
    const { feedId, folderId, all, beforeId } = req.body || {};
    let sql = 'UPDATE items SET read = 1';
    const clauses = [];
    const params = [];
    if (feedId) {
      clauses.push('feed_id = ?');
      params.push(feedId);
    } else if (folderId) {
      clauses.push('feed_id IN (SELECT id FROM feeds WHERE folder_id = ?)');
      params.push(folderId);
    } else if (!all) {
      return res.status(400).json({ error: 'feedId, folderId, or all is required' });
    }
    if (beforeId) {
      clauses.push('id <= ?');
      params.push(beforeId);
    }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    const info = db.prepare(sql).run(...params);
    res.json({ ok: true, updated: info.changes });
  });

  router.post('/:id/fulltext', async (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (!item.url) return res.status(400).json({ error: 'Item has no source URL' });
    try {
      const html = await extractFullText(item.url, item.summary);
      db.prepare('UPDATE items SET fulltext_html = ? WHERE id = ?').run(html, item.id);
      const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(item.id);
      indexItem(db, updated);
      res.json({ fulltextHtml: html });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  return router;
}

module.exports = { buildItemsRouter };
