'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const { openDb } = require('./db');
const { Poller } = require('./poller');
const { requireAuth } = require('./auth');
const { buildAuthRouter } = require('./routes/auth');
const { buildFoldersRouter } = require('./routes/folders');
const { buildFeedsRouter } = require('./routes/feeds');
const { buildItemsRouter } = require('./routes/items');
const { buildSearchRouter } = require('./routes/search');
const { buildOpmlRouter } = require('./routes/opml');
const { buildStatusRouter } = require('./routes/status');

/**
 * Build the Feedloft Express app. Shared by the production entrypoint,
 * the Electron desktop wrapper, and the smoke test -- all of them get a
 * real server bound to whatever port they choose.
 *
 * @param {object} opts
 * @param {string} opts.dbPath absolute path to the sqlite file
 * @param {string} opts.adminPassword admin login password
 * @param {number} [opts.pollMinutes] default poll interval in minutes
 * @param {boolean} [opts.startPoller] whether to start the background poller (default true)
 */
function createApp({ dbPath, adminPassword, pollMinutes = 15, startPoller = true }) {
  if (!adminPassword) throw new Error('adminPassword is required');

  const db = openDb(dbPath);
  const poller = startPoller ? new Poller(db, { defaultPollMinutes: pollMinutes }) : null;
  if (poller) poller.start();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/auth', buildAuthRouter(db, adminPassword));

  const auth = requireAuth(db);
  app.use('/api/folders', auth, buildFoldersRouter(db));
  app.use('/api/feeds', auth, buildFeedsRouter(db));
  app.use('/api/items', auth, buildItemsRouter(db));
  app.use('/api/search', auth, buildSearchRouter(db));
  app.use('/api/opml', auth, buildOpmlRouter(db));
  app.use('/api/status', auth, buildStatusRouter(db, poller));

  // Serve the built client, if present (production / desktop mode).
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, db, poller };
}

module.exports = { createApp };
