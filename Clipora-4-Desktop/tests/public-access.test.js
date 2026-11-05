import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSession } from '../server/lib/auth.js';
import { visitorOwner, canAccessJob } from '../server/lib/visitor.js';
import { validateStartup } from '../server/lib/config.js';
import { friendlyError } from '../server/lib/metadata.js';

const secret = 'test-secret-for-clipora-public-server-at-least-32-characters';
const limits = { host: '0.0.0.0', publicDownloads: true, accessPassword: '', sessionSecret: secret,
  maxDownloadMB: 45, maxTotalMB: 100, maxConcurrent: 1, maxQueued: 3,
  maxDuration: 600, maxPlaylistItems: 10 };

test('public server requires explicit mode, a valid session secret and strict quotas', () => {
  assert.doesNotThrow(() => validateStartup(limits));
  assert.throws(() => validateStartup({ ...limits, publicDownloads: false }));
  assert.throws(() => validateStartup({ ...limits, sessionSecret: '' }));
  for (const property of ['maxDownloadMB','maxTotalMB','maxConcurrent','maxQueued','maxDuration','maxPlaylistItems']) {
    const exceeded = { ...limits, [property]: limits[property] + 1 };
    assert.throws(() => validateStartup(exceeded), `expected rejection of ${property}`);
  }
});

test('anonymous visitors can access only their own downloads', () => {
  const tokenA = makeSession(secret); const tokenB = makeSession(secret);
  const ownerA = visitorOwner(tokenA, secret);
  const ownerB = visitorOwner(tokenB, secret);
  assert.notEqual(ownerA, ownerB);
  assert.equal(canAccessJob({ owner: ownerA }, ownerA, true), true);
  assert.equal(canAccessJob({ owner: ownerA }, ownerB, true), false);
  assert.equal(canAccessJob({ owner: null }, ownerA, true), false);
  assert.equal(canAccessJob({ owner: ownerA }, null, true), false);
  assert.equal(canAccessJob({ owner: ownerA }, ownerB, false), true);
  assert.equal(visitorOwner('forged.token', secret), null);
});

test('cloud YouTube bot challenge has an actionable friendly error', () => {
  const e = new Error('Downloader subprocess exited with error');
  e.stderr = 'ERROR: [youtube] abc: Sign in to confirm you are not a bot. This helps protect our community';
  assert.match(friendlyError(e, 45), /bot-verification challenge/i);
  assert.match(friendlyError(e, 45), /Desktop/i);
});
