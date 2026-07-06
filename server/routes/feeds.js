'use strict';

const express = require('express');
const { addFeed, refreshFeed } = require('../lib/feedService');

function withUnreadCounts(db, feeds) {
  const counts = db
    .prepare('SELECT feed_id, SUM(1 - read) AS unread FROM items GROUP BY feed_id')
    .all()
    .reduce((acc, r) => ({ ...acc, [r.feed_id]: r.unread }), {});
  return feeds.map((f) => ({ ...f, unreadCount: counts[f.id] || 0 }));
}

function buildFeedsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const feeds = db.prepare('SELECT * FROM feeds ORDER BY title').all();
    res.json(withUnreadCounts(db, feeds));
  });

  router.post('/', async (req, res) => {
    const { url, folderId } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });
    try {
      const { feed, items } = await addFeed(db, url, { folderId: folderId || null });
      res.status(201).json({ feed, items });
    } catch (err) {
      res.status(400).json({ error: String(err.message || err) });
    }
  });

  router.put('/:id', (req, res) => {
    const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(req.params.id);
    if (!feed) return res.status(404).json({ error: 'Not found' });
    const { title, folderId, pollMinutes, fulltextAlways } = req.body || {};
    db.prepare(
      `UPDATE feeds SET title = ?, folder_id = ?, poll_minutes = ?, fulltext_always = ? WHERE id = ?`
    ).run(
      title != null ? title : feed.title,
      folderId !== undefined ? folderId : feed.folder_id,
      pollMinutes !== undefined ? pollMinutes : feed.poll_minutes,
      fulltextAlways != null ? (fulltextAlways ? 1 : 0) : feed.fulltext_always,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM feeds WHERE id = ?').get(req.params.id));
  });

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM feeds WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  router.post('/:id/refresh', async (req, res) => {
    try {
      const result = await refreshFeed(db, req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: String(err.message || err) });
    }
  });

  return router;
}

module.exports = { buildFeedsRouter, withUnreadCounts };
