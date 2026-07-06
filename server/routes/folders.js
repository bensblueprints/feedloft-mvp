'use strict';

const express = require('express');

function buildFoldersRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const folders = db.prepare('SELECT * FROM folders ORDER BY position, name').all();
    res.json(folders);
  });

  router.post('/', (req, res) => {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM folders').get().m;
    const info = db.prepare('INSERT INTO folders (name, position) VALUES (?, ?)').run(name.trim(), maxPos + 1);
    res.status(201).json(db.prepare('SELECT * FROM folders WHERE id = ?').get(info.lastInsertRowid));
  });

  router.put('/:id', (req, res) => {
    const { name, position } = req.body || {};
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
    if (!folder) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE folders SET name = ?, position = ? WHERE id = ?').run(
      name != null ? name : folder.name,
      position != null ? position : folder.position,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id));
  });

  router.delete('/:id', (req, res) => {
    db.prepare('UPDATE feeds SET folder_id = NULL WHERE folder_id = ?').run(req.params.id);
    db.prepare('DELETE FROM folders WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { buildFoldersRouter };
