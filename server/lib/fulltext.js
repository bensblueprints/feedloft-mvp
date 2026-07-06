'use strict';

const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const sanitizeHtml = require('sanitize-html');
const { fetchWithLimits } = require('./fetcher');
const { decodeBuffer } = require('./decode');

const SANITIZE_OPTS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption', 'h1', 'h2']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'loading', 'referrerpolicy'],
    a: ['href', 'name', 'target', 'rel'],
    '*': ['id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    img: (tagName, attribs) => ({
      tagName: 'img',
      attribs: {
        ...attribs,
        loading: 'lazy',
        referrerpolicy: 'no-referrer',
      },
    }),
    a: (tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
  },
  // Scripts/iframes/objects are stripped by default (not in allowedTags).
};

/**
 * Fetch a URL and extract readable article content with Readability.
 * Degrades gracefully (returns a notice + whatever summary is available)
 * rather than throwing when extraction fails, e.g. on JS-only pages.
 */
async function extractFullText(url, fallbackSummary) {
  let buffer, headers;
  try {
    const res = await fetchWithLimits(url);
    buffer = res.buffer;
    headers = res.headers;
  } catch (err) {
    return degrade(fallbackSummary, `Could not fetch original article: ${err.message}`);
  }

  const contentType = headers && typeof headers.get === 'function' ? headers.get('content-type') : null;
  const html = decodeBuffer(buffer, contentType);

  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.content || stripTags(article.content).trim().length < 40) {
      return degrade(fallbackSummary, 'Full text extraction found no readable article content (this may be a JS-rendered page).');
    }
    return sanitizeHtml(article.content, SANITIZE_OPTS);
  } catch (err) {
    return degrade(fallbackSummary, `Full text extraction failed: ${err.message}`);
  }
}

function degrade(fallbackSummary, notice) {
  const safeSummary = fallbackSummary ? sanitizeHtml(fallbackSummary, SANITIZE_OPTS) : '';
  return `<p class="feedloft-notice"><em>${escapeHtml(notice)}</em></p>${safeSummary}`;
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { extractFullText, SANITIZE_OPTS };
