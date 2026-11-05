import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  newPairingCode, createBridgeSecret, createBridgeToken, isBrowserExtensionOrigin,
  isLocalClient, matchesSecret, ticketFor, ticketValid, safeDownloadName,
} from '../server/lib/extension-security.js';
const id = '2d7fc2be-339a-4d12-83a8-6169f690c470';
describe('Clipora extension bridge security', () => {
  it('makes an eight-digit pairing code and cryptographic token', () => {
    assert.match(newPairingCode(), /^\d{8}$/);
    assert.match(createBridgeToken(), /^[0-9a-f]{64}$/);
  });
  it('allows Chrome/Edge extension origins and rejects websites', () => {
    assert.equal(isBrowserExtensionOrigin('chrome-extension://abcdefghijklmnopabcdefghijklmnop'), true);
    assert.equal(isBrowserExtensionOrigin('https://evil.example'), false);
    assert.equal(isBrowserExtensionOrigin('chrome-extension://bad'), false);
    assert.equal(isBrowserExtensionOrigin('http://127.0.0.1:5173'), false);
  });
  it('only permits loopback network clients', () => {
    assert.equal(isLocalClient('127.0.0.1'), true);
    assert.equal(isLocalClient('::ffff:127.0.0.1'), true);
    assert.equal(isLocalClient('192.168.1.12'), false);
    assert.equal(isLocalClient('::ffff:10.0.0.2'), false);
  });
  it('compares user-entered pairing codes safely', () => {
    assert.equal(matchesSecret('12345678', '12345678'), true);
    assert.equal(matchesSecret('wrong', '12345678'), false);
    assert.equal(matchesSecret(null, '12345678'), false);
  });
  it('rejects forged, stale and cross-job download tickets', () => {
    const secret = createBridgeSecret(); const now = Date.now();
    const ticket = ticketFor(id, secret, now + 30000);
    assert.equal(ticketValid(id, ticket, secret, now), true);
    assert.equal(ticketValid(id, ticket, secret, now + 31000), false);
    assert.equal(ticketValid('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ticket, secret, now), false);
    assert.equal(ticketValid(id, ticket.slice(0, -1) + (ticket.endsWith('0') ? '1' : '0'), secret, now), false);
    assert.equal(ticketValid(id, ticket, createBridgeSecret(), now), false);
    assert.equal(ticketValid(id, 'garbage', secret, now), false);
  });
  it('never writes client paths or unsafe filename characters', () => {
    const filename = safeDownloadName('..\\\\bad/../Video:Title?<>*', 'mp4');
    assert.match(filename, /\.mp4$/);
    assert.equal(/[\\/:?<>*]/.test(filename), false);
    assert.equal(safeDownloadName('', 'bad-extension'), 'Clipora video.mp4');
  });
});
