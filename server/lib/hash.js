'use strict';

const crypto = require('crypto');

/**
 * Stable identity hash for feed items lacking a guid/id. MUST be a pure
 * function of stable inputs (title + published date) — never include
 * anything random/time-of-fetch, or the same item will look "new" on
 * every poll and duplicate forever.
 */
function stableItemHash(title, publishedAt) {
  const basis = `${title || ''}::${publishedAt || ''}`;
  return 'hash:' + crypto.createHash('sha1').update(basis).digest('hex');
}

module.exports = { stableItemHash };
