'use strict';

const Parser = require('rss-parser');
const { cleanXml } = require('./cleanXml');
const { parseFeedDate } = require('./dates');
const { stableItemHash } = require('./hash');

const parser = new Parser({
  timeout: 15000,
  customFields: {
    feed: [['link', 'links', { keepArray: true }]],
    item: [
      ['content:encoded', 'contentEncoded'],
      ['description', 'description'],
    ],
  },
});

/**
 * Parse feed XML text (RSS 2.0, RSS 1.0/RDF, or Atom -- rss-parser handles
 * all three) into a normalized shape. Never throws on malformed-but-mostly-
 * XML input: applies a tolerance cleanup pass first.
 *
 * @param {string} xmlText decoded feed text
 * @param {string} feedUrl  URL the feed was fetched from (for relative-link resolution)
 */
async function parseFeedXml(xmlText, feedUrl) {
  let text = xmlText;
  let parsed;
  try {
    parsed = await parser.parseString(text);
  } catch (err) {
    // Retry once after a tolerance cleanup pass (unescaped &, stray
    // leading bytes, etc.) before giving up.
    text = cleanXml(xmlText);
    parsed = await parser.parseString(text);
  }

  const siteUrl = firstLink(parsed) || feedUrl;
  const fetchedAt = new Date().toISOString();

  const items = (parsed.items || []).map((raw) => normalizeItem(raw, feedUrl, siteUrl, fetchedAt));

  return {
    title: parsed.title || null,
    siteUrl,
    items,
  };
}

function firstLink(parsed) {
  if (parsed.link) return parsed.link;
  if (Array.isArray(parsed.links) && parsed.links.length) {
    const alt = parsed.links.find((l) => l.$ && (!l.$.rel || l.$.rel === 'alternate'));
    if (alt && alt.$ && alt.$.href) return alt.$.href;
  }
  return null;
}

function normalizeItem(raw, feedUrl, siteUrl, fetchedAt) {
  // content precedence: content:encoded > content (atom full content) >
  // description/summary.
  const contentHtml =
    raw.contentEncoded || raw.content || raw.description || raw.summary || raw['content:encoded'] || '';

  const summary = raw.contentSnippet || stripTags(contentHtml).slice(0, 500) || null;

  let link = raw.link || raw.guid || null;
  if (link) {
    try {
      link = new URL(link, siteUrl || feedUrl).toString();
    } catch {
      /* leave as-is if it isn't resolvable */
    }
  }

  const publishedAt = parseFeedDate(raw.isoDate || raw.pubDate || raw.published || raw.updated, fetchedAt);

  const rawGuid = typeof raw.guid === 'string' ? raw.guid : raw.id;
  const guid = rawGuid && String(rawGuid).trim() ? String(rawGuid).trim() : link || stableItemHash(raw.title, publishedAt);

  return {
    guid,
    url: link,
    title: raw.title || '(untitled)',
    author: raw.creator || raw.author || null,
    contentHtml: contentHtml || null,
    summary,
    publishedAt,
  };
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { parseFeedXml };
