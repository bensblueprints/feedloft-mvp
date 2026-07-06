'use strict';

const LINK_RE = /<link\b[^>]*>/gi;
const REL_RE = /rel=["']?([^"'\s>]+)/i;
const TYPE_RE = /type=["']?([^"'\s>]+)/i;
const HREF_RE = /href=["']?([^"'\s>]+)/i;

const FEED_TYPES = new Set([
  'application/rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
]);

/**
 * Given raw HTML, find candidate feed URLs advertised via
 * <link rel="alternate" type="application/rss+xml" href="...">.
 * Returns absolute URLs resolved against baseUrl.
 */
function discoverFeedLinks(html, baseUrl) {
  const links = html.match(LINK_RE) || [];
  const candidates = [];
  for (const tag of links) {
    const relMatch = REL_RE.exec(tag);
    const typeMatch = TYPE_RE.exec(tag);
    const hrefMatch = HREF_RE.exec(tag);
    if (!hrefMatch) continue;
    const rel = relMatch ? relMatch[1].toLowerCase() : '';
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    if (rel !== 'alternate') continue;
    if (!FEED_TYPES.has(type)) continue;
    try {
      candidates.push(new URL(hrefMatch[1], baseUrl).toString());
    } catch {
      /* ignore malformed href */
    }
  }
  return candidates;
}

function looksLikeHtml(text) {
  return /<html[\s>]/i.test(text.slice(0, 2000)) || /<!doctype html/i.test(text.slice(0, 200));
}

module.exports = { discoverFeedLinks, looksLikeHtml };
