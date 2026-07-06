'use strict';

require('dotenv').config();
const path = require('path');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5331;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const POLL_MINUTES = Number(process.env.POLL_MINUTES) || 15;
const DB_PATH = process.env.FEEDLOFT_DB_PATH || path.join(__dirname, '..', 'data', 'feedloft.db');

if (ADMIN_PASSWORD === 'changeme') {
  // eslint-disable-next-line no-console
  console.warn('[feedloft] WARNING: using default ADMIN_PASSWORD. Set ADMIN_PASSWORD in .env for real use.');
}

const { app } = createApp({ dbPath: DB_PATH, adminPassword: ADMIN_PASSWORD, pollMinutes: POLL_MINUTES });

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Feedloft listening on http://localhost:${PORT}`);
});
