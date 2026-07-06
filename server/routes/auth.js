'use strict';

const express = require('express');
const { createSession, setSessionCookie, clearSessionCookie, parseCookies, isValidSession, COOKIE_NAME } = require('../auth');

function buildAuthRouter(db, adminPassword) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { password } = req.body || {};
    if (typeof password !== 'string' || password !== adminPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const sessionId = createSession(db);
    setSessionCookie(res, sessionId);
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[COOKIE_NAME];
    if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/session', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[COOKIE_NAME];
    res.json({ authenticated: isValidSession(db, sessionId) });
  });

  return router;
}

module.exports = { buildAuthRouter };
