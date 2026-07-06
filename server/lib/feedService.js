'use strict';

const sanitizeHtml = require('sanitize-html');
const { fetchWithLimits } = require('./fetcher');
const { decodeBuffer } = require('./decode');
const { parseFeedXml } = require('./feedParser');
const { discoverFeedLinks, looksLikeHtml } = require('./discover');
const { indexItem, removeItem } = require('./search');
const { SANITIZE_OPTS } = require('./fulltext');

const PRUNE_KEEP = 500;

/**
 * Resolve a user-supplied URL to an actual feed URL. If the URL points at
 * an HTML page, look for a <link rel="alternate"> feed reference.
 */
async function resolveFeedUrl(inputUrl) {
  const res = await fetchWithLimits(inputUrl);
  if (res.status === 304) return { feedUrl: inputUrl, res }; // shouldn't happen without conditional headers
  const contentType = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : '';
  const text = decodeBuffer(res.buffer, contentType);

  if (looksLikeHtml(text) && !/^\s*<\?xml|<rss|<feed\b/i.test(text)) {
    const candidates = discoverFeedLinks(text, res.finalUrl || inputUrl);
    if (candidates.length) {
      const feedRes = await fetchWithLimits(candidates[0]);
      return { feedUrl: candidates[0], res: feedRes };
    }
    throw new Error('No RSS/Atom feed could be discovered at that URL');
  }

  return { feedUrl: res.finalUrl || inputUrl, res };
}

/**
 * Add a new feed: discover (if needed), fetch, parse, and store the feed
 * plus its initial batch of items. Returns { feed, items }.
 */
async function addFeed(db, inputUrl, { folderId = null } = {}) {
  const { feedUrl, res } = await resolveFeedUrl(inputUrl);
  const contentType = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : '';
  const text = decodeBuffer(res.buffer, contentType);
  const parsed = await parseFeedXml(text, feedUrl);

  const etag = headerOrNull(res.headers, 'etag');
  const lastModified = headerOrNull(res.headers, 'last-modified');

  const insertFeed = db.prepare(`
    INSERT INTO feeds (folder_id, url, title, site_url, etag, last_modified, last_polled_at, fulltext_always, created_at)
    VALUES (@folderId, @url, @title, @siteUrl, @etag, @lastModified, @now, 0, @now)
  `);
  const now = new Date().toISOString();
  const info = insertFeed.run({
    folderId,
    url: feedUrl,
    title: parsed.title || feedUrl,
    siteUrl: parsed.siteUrl,
    etag,
    lastModified,
    now,
  });
  const feedId = info.lastInsertRowid;

  const items = storeItems(db, feedId, parsed.items);

  const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(feedId);
  return { feed, items };
}

function headerOrNull(headers, name) {
  if (!headers || typeof headers.get !== 'function') return null;
  return headers.get(name) || null;
}

/**
 * Insert new items for a feed, skipping ones we've already seen (unique
 * on feed_id+guid). Returns the newly inserted item rows.
 */
function storeItems(db, feedId, parsedItems) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO items (feed_id, guid, url, title, author, content_html, summary, published_at, created_at)
    VALUES (@feedId, @guid, @url, @title, @author, @contentHtml, @summary, @publishedAt, @now)
  `);
  const getByFeedGuid = db.prepare('SELECT * FROM items WHERE feed_id = ? AND guid = ?');

  const inserted = [];
  const now = new Date().toISOString();
  const txn = db.transaction((list) => {
    for (const it of list) {
      const safeHtml = it.contentHtml ? sanitizeHtml(it.contentHtml, SANITIZE_OPTS) : null;
      const info = insert.run({
        feedId,
        guid: it.guid,
        url: it.url,
        title: it.title,
        author: it.author,
        contentHtml: safeHtml,
        summary: it.summary,
        publishedAt: it.publishedAt,
        now,
      });
      if (info.changes > 0) {
        const row = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
        indexItem(db, row);
        inserted.push(row);
      }
    }
  });
  txn(parsedItems);
  return inserted;
}

/**
 * Poll a single feed: conditional GET, parse+store new items, update
 * error tracking, follow redirects by rewriting the stored URL, and
 * prune old read/unstarred items beyond PRUNE_KEEP.
 */
async function refreshFeed(db, feedId) {
  const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(feedId);
  if (!feed) throw new Error('Feed not found');

  const now = new Date().toISOString();

  try {
    const res = await fetchWithLimits(feed.url, {
      etag: feed.etag || undefined,
      lastModified: feed.last_modified || undefined,
    });

    if (res.status === 304) {
      db.prepare('UPDATE feeds SET last_polled_at = ?, error_count = 0, last_error = NULL WHERE id = ?').run(now, feedId);
      return { notModified: true, newItems: [] };
    }

    const contentType = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : '';
    const text = decodeBuffer(res.buffer, contentType);
    const parsed = await parseFeedXml(text, feed.url);

    const etag = headerOrNull(res.headers, 'etag');
    const lastModified = headerOrNull(res.headers, 'last-modified');
    const finalUrl = res.finalUrl || feed.url; // handles 301 redirects transparently (fetch follows + reports final URL)

    const newItems = storeItems(db, feedId, parsed.items);

    db.prepare(
      `UPDATE feeds SET url = ?, title = COALESCE(title, ?), site_url = COALESCE(?, site_url),
       etag = ?, last_modified = ?, last_polled_at = ?, error_count = 0, last_error = NULL WHERE id = ?`
    ).run(finalUrl, parsed.title || feed.title, parsed.siteUrl, etag, lastModified, now, feedId);

    pruneFeed(db, feedId);

    return { notModified: false, newItems };
  } catch (err) {
    db.prepare('UPDATE feeds SET last_polled_at = ?, error_count = error_count + 1, last_error = ? WHERE id = ?').run(
      now,
      String(err.message || err),
      feedId
    );
    return { error: String(err.message || err) };
  }
}

function pruneFeed(db, feedId) {
  const rows = db
    .prepare(
      `SELECT id FROM items WHERE feed_id = ? AND read = 1 AND starred = 0
       ORDER BY published_at DESC, id DESC LIMIT -1 OFFSET ?`
    )
    .all(feedId, PRUNE_KEEP);
  if (!rows.length) return;
  const del = db.prepare('DELETE FROM items WHERE id = ?');
  const txn = db.transaction((ids) => {
    for (const id of ids) {
      del.run(id);
      removeItem(db, id);
    }
  });
  txn(rows.map((r) => r.id));
}

module.exports = { addFeed, refreshFeed, storeItems, pruneFeed };
