import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE = 'clipora_session';
const TTL = 12 * 60 * 60 * 1000;
const text = input => Buffer.from(input).toString('base64url');
const unt = input => Buffer.from(input, 'base64url').toString('utf8');
export function makeSession(secret, now = Date.now()) {
  const payload = text(JSON.stringify({ exp: now + TTL, nonce: randomBytes(12).toString('hex') }));
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1024) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const given = Buffer.from(parts[1], 'base64url');
    if (given.toString('base64url') !== parts[1]) return false;
    const expected = createHmac('sha256', secret).update(parts[0]).digest();
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
    const data = JSON.parse(unt(parts[0]));
    return Number.isSafeInteger(data.exp) && data.exp > now && data.exp <= now + TTL;
  } catch { return false; }
}
export function verifyPassword(input, expected) {
  if (typeof input !== 'string' || input.length > 1024) return false;
  const a = createHmac('sha256', 'clipora-comparison').update(input).digest();
  const b = createHmac('sha256', 'clipora-comparison').update(expected).digest();
  return timingSafeEqual(a, b);
}
export function cookieValue(request) {
  const cookie = request.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)clipora_session=([^;]*)/);
  return match ? match[1] : null;
}
export function setSessionCookie(res, token, req) {
  // req.secure is true behind a properly configured HTTPS reverse proxy.
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: TTL, path: '/' });
}
export function clearSessionCookie(res, req) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });
}
