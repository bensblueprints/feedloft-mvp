'use strict';

const express = require('express');

function buildStatusRouter(db, poller) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const feeds = db.prepare('SELECT id, title, url, error_count, last_error, last_polled_at FROM feeds').all();
    const failing = feeds.filter((f) => f.error_count > 0);
    const totalUnread = db.prepare('SELECT COUNT(*) AS c FROM items WHERE read = 0').get().c;
    res.json({
      feedCount: feeds.length,
      failingFeeds: failing,
      totalUnread,
      poller: poller ? poller.stats : null,
    });
  });

  return router;
}

module.exports = { buildStatusRouter };
