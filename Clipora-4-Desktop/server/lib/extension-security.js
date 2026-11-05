import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const newPairingCode = () => String(randomInt(10000000, 100000000));
export const createBridgeSecret = () => randomBytes(32);
export const createBridgeToken = () => randomBytes(32).toString('hex');
export function isBrowserExtensionOrigin(value) {
  return typeof value === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(value);
}
export function isLocalClient(value) {
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}
export function matchesSecret(submitted, actual) {
  if (typeof submitted !== 'string' || typeof actual !== 'string') return false;
  const a = Buffer.from(submitted); const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function ticketFor(id, key, expiresAt) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid job identifier.');
  const expiry = String(expiresAt);
  const message = `${id}.${expiry}`;
  return `${expiry}.${createHmac('sha256', key).update(message).digest('hex')}`;
}
export function ticketValid(id, ticket, key, now = Date.now()) {
  if (typeof ticket !== 'string') return false;
  const match = /^(\d{13})\.([0-9a-f]{64})$/.exec(ticket);
  if (!match) return false;
  const expiry = Number(match[1]);
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + 26 * 3600000) return false;
  try { return matchesSecret(ticketFor(id, key, expiry), ticket); }
  catch { return false; }
}
export function safeDownloadName(name, extension) {
  const base = String(name || 'Clipora video').normalize('NFKC')
    .replace(/[\\/\u0000-\u001f:*?"<>|]/g, ' ')
    .replace(/[^\p{L}\p{N}._ ()-]/gu, '_').trim().slice(0, 90).replace(/^[. ]+|[. ]+$/g, '') || 'Clipora video';
  const ext = /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'mp4';
  return `${base}.${ext}`;
}
