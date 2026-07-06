'use strict';

/**
 * Parse a feed-supplied date string (RFC822, ISO8601, or garbage) into an
 * ISO8601 string. Falls back to the provided fetchTime (or now) when the
 * input can't be parsed, rather than throwing.
 */
function parseFeedDate(input, fallback) {
  if (input) {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const fb = fallback ? new Date(fallback) : new Date();
  return Number.isNaN(fb.getTime()) ? new Date().toISOString() : fb.toISOString();
}

module.exports = { parseFeedDate };
