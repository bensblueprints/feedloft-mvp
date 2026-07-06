'use strict';

const xml2js = require('xml2js');

/**
 * Parse OPML text into { folders: [{name, feeds: [{title, xmlUrl, htmlUrl}]}],
 * rootFeeds: [{title, xmlUrl, htmlUrl}] } preserving one level of nesting.
 */
async function parseOpml(text) {
  const parsed = await xml2js.parseStringPromise(text, { explicitArray: true, mergeAttrs: false });
  const body = parsed && parsed.opml && parsed.opml.body && parsed.opml.body[0];
  if (!body) return { folders: [], rootFeeds: [] };

  const outlines = body.outline || [];
  const folders = [];
  const rootFeeds = [];

  for (const outline of outlines) {
    const attrs = outline.$ || {};
    if (attrs.xmlUrl) {
      rootFeeds.push(toFeed(attrs));
    } else if (outline.outline) {
      // Folder: one level of nested outlines are feeds.
      const children = outline.outline
        .map((child) => child.$ || {})
        .filter((a) => a.xmlUrl)
        .map(toFeed);
      folders.push({ name: attrs.title || attrs.text || 'Folder', feeds: children });
    } else {
      // Empty folder or unknown outline without xmlUrl/children.
      folders.push({ name: attrs.title || attrs.text || 'Folder', feeds: [] });
    }
  }

  return { folders, rootFeeds };
}

function toFeed(attrs) {
  return {
    title: attrs.title || attrs.text || attrs.xmlUrl,
    xmlUrl: attrs.xmlUrl,
    htmlUrl: attrs.htmlUrl || null,
  };
}

/**
 * Build OPML 2.0 XML from folders + feeds stored in the DB.
 */
function buildOpml(folders, feedsByFolder, unfiledFeeds) {
  const esc = (s) =>
    String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

  const feedOutline = (f) =>
    `<outline text="${esc(f.title)}" title="${esc(f.title)}" type="rss" xmlUrl="${esc(f.url)}"${
      f.site_url ? ` htmlUrl="${esc(f.site_url)}"` : ''
    } />`;

  const folderBlocks = folders
    .map((folder) => {
      const feeds = (feedsByFolder[folder.id] || []).map(feedOutline).join('\n      ');
      return `    <outline text="${esc(folder.name)}" title="${esc(folder.name)}">\n      ${feeds}\n    </outline>`;
    })
    .join('\n');

  const rootBlocks = unfiledFeeds.map(feedOutline).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Feedloft subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${folderBlocks}
    ${rootBlocks}
  </body>
</opml>`;
}

module.exports = { parseOpml, buildOpml };
