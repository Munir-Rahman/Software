import https from 'node:https';
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import fs from 'node:fs';
import { userError, parseUrl, DIRECT_EXTENSIONS } from '../validation.js';

// Direct HTTPS media download: resolve IPv4 and PIN the resolved public address
// for each request, including redirects. No IP literals, private/link-local IPv4,
// local hostnames, custom ports, credentials, cookies, or user-provided headers.
export function isPublicIPv4(ip) {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 ||
      a === 100 && b >= 64 && b <= 127 || a === 192 && b === 0 && (c === 0 || c === 2) ||
      a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) ||
      a === 203 && b === 0 && c === 113 || a === 192 && b === 88 && c === 99 ||
      a === 192 && b === 0 && c === 0 || a === 255) return false;
  return true;
}
export function validateDirectUrl(url) {
  const u = parseUrl(url);
  if (u.protocol !== 'https:' || u.port || isIP(u.hostname) || !u.hostname.includes('.') ||
      u.hostname.endsWith('.local') || u.hostname.endsWith('.internal') || u.hostname.endsWith('.localhost')) {
    throw userError('Direct media requires a public HTTPS host with no custom port.');
  }
  const ext = /\.[a-z0-9]+$/i.exec(u.pathname)?.[0]?.toLowerCase();
  const kind = ext && DIRECT_EXTENSIONS[ext];
  if (!kind) throw userError('A direct media URL must end in a supported image, audio, or video file extension.');
  return { url: u.href, ext, kind };
}
async function requestPinned(url, signal) {
  const u = new URL(url);
  const { address } = (await dns.lookup(u.hostname, { family: 4, all: true })).find(x => isPublicIPv4(x.address)) || {};
  if (!address) throw userError('Media host has no verified public IPv4 address.', 403);
  return new Promise((resolve, reject) => {
    const request = https.get(u, {
      lookup: (_host, _opts, cb) => cb(null, address, 4),
      timeout: 20000, headers: { 'User-Agent': 'Clipora/3.0 (authorized direct media)', 'Accept': 'video/*, audio/*, image/*' },
      maxHeaderSize: 16 * 1024,
    }, response => resolve(response));
    request.on('timeout', () => request.destroy(userError('Media server timeout.', 504)));
    request.on('error', reject);
    if (signal) {
      if (signal.aborted) request.destroy(userError('Download cancelled.', 409));
      else signal.addEventListener('abort', () => request.destroy(userError('Download cancelled.', 409)), { once: true });
    }
  });
}
const mimeOk = (mime, kind) => !mime || mime.startsWith(`${kind}/`) || (kind === 'video' && mime === 'application/octet-stream') || (kind === 'audio' && ['application/ogg', 'application/octet-stream'].includes(mime));
export async function downloadDirect(url, file, maxBytes, { signal, onProgress } = {}) {
  const expected = validateDirectUrl(url);
  let current = expected.url;
  for (let redirect = 0; redirect <= 3; redirect++) {
    validateDirectUrl(current);
    const response = await requestPinned(current, signal);
    const status = response.statusCode;
    if ([301,302,303,307,308].includes(status)) {
      const location = response.headers.location;
      response.resume();
      if (!location) throw userError('Invalid media redirect.', 502);
      const next = new URL(location, current);
      // Redirects to a different extension are deliberately rejected.
      const candidate = validateDirectUrl(next.href);
      if (candidate.kind !== expected.kind) throw userError('Media redirect changed file category.', 403);
      current = next.href;
      continue;
    }
    if (status !== 200) { response.resume(); throw userError(`Media server returned HTTP ${status}.`, 502); }
    const mime = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!mimeOk(mime, expected.kind)) { response.destroy(); throw userError(`Expected ${expected.kind}, received ${mime || 'unknown content type'}.`, 422); }
    const declared = Number(response.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) { response.destroy(); throw userError('File exceeds the configured size limit.', 413); }
    let size = 0;
    const counter = new Transform({ transform(chunk, _encoding, callback) {
      size += chunk.length;
      if (size > maxBytes) return callback(userError('Media file exceeds the configured size limit.', 413));
      onProgress?.(Number.isFinite(declared) && declared > 0 ? Math.min(98, Math.round(size / declared * 100)) : 0);
      callback(null, chunk);
    } });
    await pipeline(response, counter, fs.createWriteStream(file, { flags: 'wx', mode: 0o600 }), { signal });
    return { size, ext: expected.ext, kind: expected.kind };
  }
  throw userError('Too many media redirects.', 422);
}
