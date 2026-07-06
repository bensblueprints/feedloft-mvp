'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { createApp } = require('../server/app');
const { createSession, setSessionCookie } = require('../server/auth');

let mainWindow;
let serverHandle;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function startServer() {
  const userDataDir = app.getPath('userData');
  const dbPath = path.join(userDataDir, 'feedloft-data', 'feedloft.db');
  // Desktop installs get a locally-generated admin password so the app is
  // still protected if the machine is shared, but the user is auto-logged
  // in below -- they never have to type it.
  const adminPassword = crypto.randomBytes(16).toString('hex');

  const { app: expressApp, db } = createApp({
    dbPath,
    adminPassword,
    pollMinutes: Number(process.env.POLL_MINUTES) || 15,
    startPoller: true,
  });

  const port = await findFreePort();
  const server = await new Promise((resolve) => {
    const s = expressApp.listen(port, '127.0.0.1', () => resolve(s));
  });

  const sessionId = createSession(db);

  return { server, port, sessionId };
}

async function createWindow() {
  serverHandle = await startServer();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b0d10',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Auto-login: set the session cookie via a filter before loading, so the
  // desktop app opens straight into the reader.
  const cookie = {
    url: `http://127.0.0.1:${serverHandle.port}`,
    name: 'feedloft_session',
    value: serverHandle.sessionId,
    httpOnly: true,
    sameSite: 'lax',
  };
  await mainWindow.webContents.session.cookies.set(cookie);

  mainWindow.loadURL(`http://127.0.0.1:${serverHandle.port}/`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverHandle && serverHandle.server) {
    serverHandle.server.close();
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
