'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'feedloft_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function createSession(db) {
  const id = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (id, created_at) VALUES (?, ?)').run(id, new Date().toISOString());
  return id;
}

function isValidSession(db, sessionId) {
  if (!sessionId) return false;
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!row) return false;
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > SESSION_TTL_MS) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return false;
  }
  return true;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function requireAuth(db) {
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[COOKIE_NAME];
    if (isValidSession(db, sessionId)) {
      req.sessionId = sessionId;
      return next();
    }
    return res.status(401).json({ error: 'Not authenticated' });
  };
}

function setSessionCookie(res, sessionId, { secure = false } = {}) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
}

module.exports = {
  COOKIE_NAME,
  createSession,
  isValidSession,
  parseCookies,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
};
