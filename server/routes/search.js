'use strict';

const express = require('express');
const { search } = require('../lib/search');

function buildSearchRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { q, feed } = req.query;
    const results = search(db, q, { feedId: feed ? Number(feed) : undefined });
    res.json(results);
  });

  return router;
}

module.exports = { buildSearchRouter };
