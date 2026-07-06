'use strict';

const iconv = require('iconv-lite');

/**
 * Decode a raw response buffer to a UTF-8 string, figuring out the source
 * encoding from (in priority order): a BOM, the HTTP Content-Type header,
 * or the <?xml ... encoding="..."?> prolog. Falls back to utf-8.
 */
function decodeBuffer(buffer, contentTypeHeader) {
  let encoding = null;

  // BOM sniffing
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    encoding = 'utf-8';
  } else if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    encoding = 'utf-16le';
  } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    encoding = 'utf-16be';
  }

  if (!encoding && contentTypeHeader) {
    const m = /charset=([^;]+)/i.exec(contentTypeHeader);
    if (m) encoding = m[1].trim().replace(/["']/g, '');
  }

  if (!encoding) {
    // Sniff the XML prolog from the first bytes as latin1 (safe superset
    // for ASCII-range prolog text) to find an explicit encoding="...".
    const head = buffer.slice(0, 200).toString('latin1');
    const m = /<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(head);
    if (m) encoding = m[1].trim();
  }

  if (!encoding) encoding = 'utf-8';

  const normalized = encoding.toLowerCase();
  if (normalized === 'utf-8' || normalized === 'utf8') {
    // Strip BOM if present so downstream XML parsers don't choke on it.
    return stripBom(buffer.toString('utf-8'));
  }

  if (!iconv.encodingExists(normalized)) {
    return stripBom(buffer.toString('utf-8'));
  }

  return stripBom(iconv.decode(buffer, normalized));
}

function stripBom(str) {
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
}

module.exports = { decodeBuffer };
