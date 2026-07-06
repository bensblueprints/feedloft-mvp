'use strict';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB response size cap
const TIMEOUT_MS = 15000;

/**
 * Fetch a URL with a hard timeout and a response-size cap, honoring
 * conditional GET headers (ETag / Last-Modified) when provided. Returns
 * the raw Buffer (not decoded) so callers can pick the right charset.
 */
async function fetchWithLimits(url, { etag, lastModified, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const reqHeaders = {
    'User-Agent': 'Feedloft/1.0 (+https://github.com/bensblueprints/onetime-suite)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*',
    ...headers,
  };

  // Never send both an If-None-Match and a stale/absent If-Modified-Since
  // together in a way that could confuse the origin — prefer ETag alone
  // when present, otherwise fall back to Last-Modified alone.
  if (etag) {
    reqHeaders['If-None-Match'] = etag;
  } else if (lastModified) {
    reqHeaders['If-Modified-Since'] = lastModified;
  }

  let res;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: reqHeaders,
    });
  } finally {
    clearTimeout(timer);
  }

  const finalUrl = res.url || url;

  if (res.status === 304) {
    return { status: 304, finalUrl, headers: res.headers };
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_BYTES) {
    throw new Error(`Response too large (${contentLength} bytes)`);
  }

  const arrayBuffer = await readCapped(res, MAX_BYTES);
  const buffer = Buffer.from(arrayBuffer);

  return {
    status: res.status,
    finalUrl,
    headers: res.headers,
    buffer,
  };
}

async function readCapped(res, maxBytes) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    // Environments without a streamable body: fall back to arrayBuffer()
    // but still guard against huge payloads after the fact.
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) throw new Error('Response too large');
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel().catch(() => {});
      throw new Error('Response too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

module.exports = { fetchWithLimits, MAX_BYTES, TIMEOUT_MS };
