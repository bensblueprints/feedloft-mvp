'use strict';

/**
 * Feedloft smoke test — no mocks. Boots a real fixture HTTP server, a real
 * Feedloft server (in-process, ephemeral port), and a real temp SQLite
 * database, then drives the full flow described in the product spec.
 *
 * Run with: npm test
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFixtureServer } = require('./fixtureServer');
const { createApp } = require('../server/app');

const ADMIN_PASSWORD = 'smoke-test-password';

function log(msg) {
  console.log(`  ${msg}`);
}

// --- tiny authenticated HTTP client with manual cookie jar ---------------
function makeClient(baseUrl) {
  let cookie = null;
  async function req(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, data };
  }
  async function upload(path, formData) {
    const headers = {};
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: formData });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, data };
  }
  return {
    get: (p) => req('GET', p),
    post: (p, b) => req('POST', p, b === undefined ? {} : b),
    put: (p, b) => req('PUT', p, b),
    del: (p) => req('DELETE', p),
    upload,
  };
}

async function main() {
  let failures = 0;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedloft-smoke-'));
  const dbPath = path.join(tmpDir, 'feedloft-test.db');

  const fixture = createFixtureServer();
  const fixturePort = await fixture.listen(0);
  const fixtureBase = `http://127.0.0.1:${fixturePort}`;
  log(`Fixture server listening on ${fixtureBase}`);

  const { app, db, poller } = createApp({ dbPath, adminPassword: ADMIN_PASSWORD, startPoller: false });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  log(`Feedloft server listening on ${base} (db: ${dbPath})`);

  const client = makeClient(base);

  try {
    // --- Step 1: login + add RSS fixture -----------------------------
    {
      const bad = await client.post('/api/auth/login', { password: 'wrong' });
      assert.strictEqual(bad.status, 401, 'wrong password should be rejected');

      const login = await client.post('/api/auth/login', { password: ADMIN_PASSWORD });
      assert.strictEqual(login.status, 200, 'login should succeed');

      const addRss = await client.post('/api/feeds', { url: `${fixtureBase}/feed/rss` });
      assert.strictEqual(addRss.status, 201, `add RSS feed failed: ${JSON.stringify(addRss.data)}`);
      assert.strictEqual(addRss.data.items.length, 3, 'RSS fixture should yield 3 items');

      const feedsAfterRss = await client.get('/api/feeds');
      const rssFeed = feedsAfterRss.data.find((f) => f.url.includes('/feed/rss'));
      assert.ok(rssFeed, 'rss feed should be listed');
      assert.strictEqual(rssFeed.unreadCount, 3, 'unread count should be 3 after adding RSS feed');
      global.__rssFeedId = rssFeed.id;
      log('Step 1 OK: login + RSS feed add (3 items, unread=3)');
    }

    // --- Step 2: add Atom fixture -------------------------------------
    {
      const addAtom = await client.post('/api/feeds', { url: `${fixtureBase}/feed/atom` });
      assert.strictEqual(addAtom.status, 201, `add Atom feed failed: ${JSON.stringify(addAtom.data)}`);
      assert.strictEqual(addAtom.data.items.length, 2, 'Atom fixture should yield 2 items');
      const first = addAtom.data.items.find((i) => i.title === 'Atom Entry One');
      assert.ok(first, 'Atom item title should parse correctly');
      assert.ok(first.url.endsWith('/article/atom-1'), `Atom item link should parse correctly, got ${first.url}`);
      assert.ok(first.published_at.startsWith('2026-01-15'), `Atom item date should parse correctly, got ${first.published_at}`);
      global.__atomFeedId = addAtom.data.feed.id;
      log('Step 2 OK: Atom feed parses title/date/link correctly');
    }

    // --- Step 3: refresh RSS feed again -> expect 304, count unchanged -
    {
      const before = await client.get('/api/feeds');
      const feedBefore = before.data.find((f) => f.id === global.__rssFeedId);
      const lastPolledBefore = feedBefore.last_polled_at;

      // Small delay so a changed last_polled_at timestamp is distinguishable.
      await new Promise((r) => setTimeout(r, 1100));

      const refresh = await client.post(`/api/feeds/${global.__rssFeedId}/refresh`);
      assert.strictEqual(refresh.status, 200, `refresh failed: ${JSON.stringify(refresh.data)}`);
      assert.strictEqual(fixture.state.lastRssRequestHadIfNoneMatch, true, 'server should have sent If-None-Match');
      assert.strictEqual(refresh.data.notModified, true, 'fixture should have returned 304');
      assert.strictEqual(refresh.data.newItems.length, 0, 'no new items expected on 304');

      const itemsAfter = await client.get(`/api/items?feed=${global.__rssFeedId}`);
      assert.strictEqual(itemsAfter.data.length, 3, 'item count should be unchanged after 304');

      const after = await client.get('/api/feeds');
      const feedAfter = after.data.find((f) => f.id === global.__rssFeedId);
      assert.notStrictEqual(feedAfter.last_polled_at, lastPolledBefore, 'last_polled_at should update even on 304');
      log('Step 3 OK: conditional GET sent If-None-Match, got 304, count unchanged, last_polled_at updated');
    }

    // --- Step 4: mutate fixture feed (4th item, new ETag) -> refresh ---
    {
      fixture.addFourthItem();
      const refresh = await client.post(`/api/feeds/${global.__rssFeedId}/refresh`);
      assert.strictEqual(refresh.status, 200, `refresh failed: ${JSON.stringify(refresh.data)}`);
      assert.strictEqual(refresh.data.newItems.length, 1, `expected exactly 1 new item, got ${refresh.data.newItems.length}`);

      // Refresh again with unchanged feed to confirm guid-dedupe holds (no dupes of items 1-3).
      const refresh2 = await client.post(`/api/feeds/${global.__rssFeedId}/refresh`);
      assert.ok(refresh2.data.notModified || refresh2.data.newItems.length === 0, 'second refresh should add nothing new');

      const itemsAfter = await client.get(`/api/items?feed=${global.__rssFeedId}`);
      assert.strictEqual(itemsAfter.data.length, 4, 'item count should be 4 after mutation+refresh');
      log('Step 4 OK: exactly 1 new item after mutation, guid dedupe holds on repeat refresh');
    }

    // --- Step 5: full-text extraction on truncated item -----------------
    let truncatedItemId;
    {
      const addTrunc = await client.post('/api/feeds', { url: `${fixtureBase}/feed/truncated` });
      assert.strictEqual(addTrunc.status, 201, `add truncated feed failed: ${JSON.stringify(addTrunc.data)}`);
      truncatedItemId = addTrunc.data.items[0].id;

      const fulltext = await client.post(`/api/items/${truncatedItemId}/fulltext`);
      assert.strictEqual(fulltext.status, 200, `fulltext extraction failed: ${JSON.stringify(fulltext.data)}`);
      const html = fulltext.data.fulltextHtml;
      assert.ok(html.includes('The Full Article Headline') || html.includes('quetzalcanyon'), `extracted html missing article body text: ${html.slice(0, 300)}`);
      assert.ok(!html.includes('Contact nav junk link list'), 'extracted html should not include <nav> junk');
      log('Step 5 OK: full-text extraction contains article body, excludes nav junk');
    }

    // --- Step 6: mark read/star + search ---------------------------------
    {
      const items = await client.get(`/api/items?feed=${global.__rssFeedId}`);
      const target = items.data[0];

      const updated = await client.put(`/api/items/${target.id}`, { read: 1, starred: 1 });
      assert.strictEqual(updated.status, 200, 'update item should succeed');
      assert.strictEqual(updated.data.read, 1, 'item should be marked read');
      assert.strictEqual(updated.data.starred, 1, 'item should be marked starred');

      const starred = await client.get('/api/items?starred=1');
      assert.ok(starred.data.some((i) => i.id === target.id), 'starred filter should include the item');

      const unreadItems = await client.get(`/api/items?feed=${global.__rssFeedId}&unread=1`);
      assert.ok(!unreadItems.data.some((i) => i.id === target.id), 'unread filter should exclude the read item');

      const search = await client.get('/api/search?q=zephyrwhistle');
      assert.ok(search.data.length > 0, 'FTS search should find item by body word');
      log('Step 6 OK: read/star mutations apply, FTS5 search finds item by body word');
    }

    // --- Step 7: OPML import + export round trip -------------------------
    {
      const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test subscriptions</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline text="Fixture RSS Feed" title="Fixture RSS Feed" type="rss" xmlUrl="${fixtureBase}/feed/rss" htmlUrl="${fixtureBase}/" />
      <outline text="Fixture Atom Feed" title="Fixture Atom Feed" type="rss" xmlUrl="${fixtureBase}/feed/atom" htmlUrl="${fixtureBase}/" />
    </outline>
    <outline text="News" title="News">
      <outline text="Fixture Extra Feed" title="Fixture Extra Feed" type="rss" xmlUrl="${fixtureBase}/feed/extra" htmlUrl="${fixtureBase}/" />
    </outline>
  </body>
</opml>`;

      const form = new FormData();
      form.append('file', new Blob([opml], { type: 'text/x-opml' }), 'test.opml');
      const importRes = await client.upload('/api/opml/import', form);
      assert.strictEqual(importRes.status, 200, `OPML import failed: ${JSON.stringify(importRes.data)}`);
      assert.strictEqual(importRes.data.foldersCreated, 2, `expected 2 folders created, got ${importRes.data.foldersCreated}`);
      // rss + atom feeds already exist (unique URL constraint) so they'll
      // fail to re-add; only the brand-new "extra" feed should succeed.
      assert.strictEqual(importRes.data.feedsAdded, 1, `expected 1 newly-added feed (rss/atom already existed), got ${importRes.data.feedsAdded}`);

      const foldersRes = await client.get('/api/folders');
      const folderNames = foldersRes.data.map((f) => f.name).sort();
      assert.deepStrictEqual(folderNames, ['News', 'Tech'], `expected Tech + News folders, got ${JSON.stringify(folderNames)}`);

      const exportRes = await client.get('/api/opml/export');
      assert.strictEqual(exportRes.status, 200, 'OPML export should succeed');
      const xml = exportRes.data;
      assert.ok(xml.includes('<opml version="2.0">'), 'export should be OPML 2.0');
      assert.ok(xml.includes(`xmlUrl="${fixtureBase}/feed/rss"`), 'export should round-trip rss feed url');
      assert.ok(xml.includes(`xmlUrl="${fixtureBase}/feed/atom"`), 'export should round-trip atom feed url');
      assert.ok(xml.includes(`xmlUrl="${fixtureBase}/feed/extra"`), 'export should round-trip extra feed url');
      assert.ok(xml.includes('text="Tech"'), 'export should include Tech folder');
      assert.ok(xml.includes('text="News"'), 'export should include News folder');

      log('Step 7 OK: OPML import created folder structure, export round-trips folders + xmlUrls');
    }

    console.log('\nAll 7 smoke test steps passed.\n');
  } catch (err) {
    failures++;
    console.error('\nSMOKE TEST FAILURE:', err);
  } finally {
    if (poller) poller.stop();
    await new Promise((resolve) => server.close(resolve));
    await fixture.close();
    try {
      db.close();
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (cleanupErr) {
      console.warn('(non-fatal) could not remove temp dir:', cleanupErr.message);
    }
  }

  process.exit(failures ? 1 : 0);
}

main();
