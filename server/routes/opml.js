'use strict';

const express = require('express');
const multer = require('multer');
const { parseOpml, buildOpml } = require('../lib/opml');
const { addFeed } = require('../lib/feedService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function buildOpmlRouter(db) {
  const router = express.Router();

  router.post('/import', upload.single('file'), async (req, res) => {
    const text = req.file ? req.file.buffer.toString('utf-8') : req.body && req.body.opml;
    if (!text) return res.status(400).json({ error: 'No OPML file/content provided' });

    let doc;
    try {
      doc = await parseOpml(text);
    } catch (err) {
      return res.status(400).json({ error: `Invalid OPML: ${err.message}` });
    }

    const results = { foldersCreated: 0, feedsAdded: 0, feedsFailed: [] };

    const addAll = async (feedDefs, folderId) => {
      for (const f of feedDefs) {
        try {
          await addFeed(db, f.xmlUrl, { folderId });
          results.feedsAdded++;
        } catch (err) {
          results.feedsFailed.push({ url: f.xmlUrl, error: String(err.message || err) });
        }
      }
    };

    for (const folder of doc.folders) {
      const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM folders').get().m;
      const info = db.prepare('INSERT INTO folders (name, position) VALUES (?, ?)').run(folder.name, maxPos + 1);
      results.foldersCreated++;
      await addAll(folder.feeds, info.lastInsertRowid);
    }
    await addAll(doc.rootFeeds, null);

    res.json(results);
  });

  router.get('/export', (req, res) => {
    const folders = db.prepare('SELECT * FROM folders ORDER BY position, name').all();
    const feeds = db.prepare('SELECT * FROM feeds ORDER BY title').all();
    const feedsByFolder = {};
    const unfiled = [];
    for (const f of feeds) {
      if (f.folder_id) {
        feedsByFolder[f.folder_id] = feedsByFolder[f.folder_id] || [];
        feedsByFolder[f.folder_id].push(f);
      } else {
        unfiled.push(f);
      }
    }
    const xml = buildOpml(folders, feedsByFolder, unfiled);
    res.setHeader('Content-Type', 'text/x-opml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="feedloft-subscriptions.opml"');
    res.send(xml);
  });

  return router;
}

module.exports = { buildOpmlRouter };
