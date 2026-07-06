'use strict';

/**
 * Best-effort tolerance pass for malformed feed XML: trims leading
 * whitespace/junk before the first tag (some servers prepend BOM leftovers
 * or whitespace which trips strict XML parsers), and escapes bare `&`
 * characters that are not part of a valid entity reference (a very common
 * real-world feed bug).
 */
function cleanXml(xml) {
  let out = xml;

  // Drop anything before the first '<' (stray whitespace/garbage).
  const firstTag = out.indexOf('<');
  if (firstTag > 0) out = out.slice(firstTag);

  // Escape bare ampersands: any & not followed by a known entity pattern.
  out = out.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');

  return out;
}

module.exports = { cleanXml };
