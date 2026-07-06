'use strict';

const http = require('http');

/**
 * Fixture HTTP server for the smoke test. Serves:
 *  - /feed/rss        RSS 2.0 feed with 3 items (mutable: can gain a 4th)
 *  - /feed/atom       Atom feed with 2 items
 *  - /feed/truncated  RSS feed with 1 truncated item linking to /article/full
 *  - /feed/extra      Simple RSS feed with 1 item (used for OPML import test)
 *  - /article/full    Full HTML article page (with <nav> junk to be stripped)
 *
 * Honors conditional GET: tracks whether the last /feed/rss request sent
 * If-None-Match, and replies 304 when it matches the current ETag.
 */
function createFixtureServer() {
  const state = {
    rssEtag: 'W/"rss-v1"',
    rssItemCount: 3,
    lastRssRequestHadIfNoneMatch: false,
    lastRssIfNoneMatchValue: null,
  };

  function rssXml() {
    const items = [];
    for (let i = 1; i <= state.rssItemCount; i++) {
      items.push(`
        <item>
          <title>RSS Item ${i}</title>
          <link>http://127.0.0.1:__PORT__/article/rss-item-${i}</link>
          <guid isPermaLink="false">rss-item-guid-${i}</guid>
          <pubDate>${new Date(Date.now() - i * 60000).toUTCString()}</pubDate>
          <description>Body text for RSS item ${i} mentioning the word zephyrwhistle for search testing.</description>
        </item>`);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture RSS Feed</title>
    <link>http://127.0.0.1:__PORT__/</link>
    <description>A fixture feed</description>
    ${items.join('\n')}
  </channel>
</rss>`;
  }

  function atomXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Fixture Atom Feed</title>
  <link href="http://127.0.0.1:__PORT__/" />
  <id>urn:fixture:atom</id>
  <updated>${new Date().toISOString()}</updated>
  <entry>
    <title>Atom Entry One</title>
    <link href="http://127.0.0.1:__PORT__/article/atom-1" />
    <id>urn:fixture:atom:1</id>
    <updated>2026-01-15T10:00:00Z</updated>
    <content type="html">Atom entry one body text.</content>
  </entry>
  <entry>
    <title>Atom Entry Two</title>
    <link href="http://127.0.0.1:__PORT__/article/atom-2" />
    <id>urn:fixture:atom:2</id>
    <updated>2026-01-16T10:00:00Z</updated>
    <content type="html">Atom entry two body text.</content>
  </entry>
</feed>`;
  }

  function truncatedXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture Truncated Feed</title>
    <link>http://127.0.0.1:__PORT__/</link>
    <item>
      <title>Truncated Article</title>
      <link>http://127.0.0.1:__PORT__/article/full</link>
      <guid isPermaLink="false">truncated-item-1</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>Read more...</description>
    </item>
  </channel>
</rss>`;
  }

  function extraXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture Extra Feed</title>
    <link>http://127.0.0.1:__PORT__/</link>
    <item>
      <title>Extra Item</title>
      <link>http://127.0.0.1:__PORT__/article/extra-1</link>
      <guid isPermaLink="false">extra-item-1</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>Extra feed body text.</description>
    </item>
  </channel>
</rss>`;
  }

  const FULL_ARTICLE_HTML = `<!doctype html>
<html>
<head><title>Full Article</title></head>
<body>
  <nav><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact nav junk link list</a></nav>
  <header><h1>Site Header Junk</h1></header>
  <article>
    <h1>The Full Article Headline</h1>
    <p>This is the first real paragraph of the full article body, and it is
    long enough that Readability should confidently pick it as the main
    content region of the page, containing the marker phrase
    quetzalcanyon for full-text search assertions.</p>
    <p>A second paragraph adds more substantive text so the extraction
    algorithm has plenty of signal: repeated sentences, real words, and
    enough density to outrank the surrounding navigation chrome.</p>
    <p>A third paragraph continues the article with more filler content
    describing the fixture scenario in enough detail to be a convincing
    stand-in for a real blog post about self-hosted software.</p>
  </article>
  <footer>Site footer junk navigation links here too</footer>
</body>
</html>`;

  let server;

  const httpServer = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const port = server.address().port;
    const sub = (s) => s.split('__PORT__').join(String(port));

    if (url.pathname === '/feed/rss') {
      const inm = req.headers['if-none-match'];
      state.lastRssRequestHadIfNoneMatch = !!inm;
      state.lastRssIfNoneMatchValue = inm || null;
      if (inm && inm === state.rssEtag) {
        res.writeHead(304, { ETag: state.rssEtag });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', ETag: state.rssEtag });
      res.end(sub(rssXml()));
      return;
    }

    if (url.pathname === '/feed/atom') {
      res.writeHead(200, { 'Content-Type': 'application/atom+xml; charset=utf-8' });
      res.end(sub(atomXml()));
      return;
    }

    if (url.pathname === '/feed/truncated') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(sub(truncatedXml()));
      return;
    }

    if (url.pathname === '/feed/extra') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(sub(extraXml()));
      return;
    }

    if (url.pathname === '/article/full') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(FULL_ARTICLE_HTML);
      return;
    }

    if (url.pathname.startsWith('/article/')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><body><article><h1>${url.pathname}</h1><p>Placeholder article body.</p></article></body></html>`);
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  server = httpServer;

  return {
    server,
    state,
    addFourthItem() {
      state.rssItemCount = 4;
      state.rssEtag = 'W/"rss-v2"';
    },
    listen(port = 0) {
      return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => resolve(server.address().port));
      });
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

module.exports = { createFixtureServer };
