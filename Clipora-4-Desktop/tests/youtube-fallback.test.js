import { test } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeArgs, isBotVerification, withYoutubeFallback } from '../server/lib/youtube-fallback.js';

const blocked = Object.assign(new Error('Downloader subprocess exited with error'), {
  stderr: "ERROR: [youtube] xyz: Sign in to confirm you're not a bot. This helps protect our community",
});

test('fallback passes documented embedded player client only when selected', () => {
  assert.deepEqual(youtubeArgs('default'), []);
  assert.deepEqual(youtubeArgs('embedded'), ['--extractor-args','youtube:player_client=web_embedded']);
});

test('recognize bot challenges but not unrelated provider failures', () => {
  assert.equal(isBotVerification(blocked), true);
  assert.equal(isBotVerification({ stderr: 'ERROR: Private video' }), false);
});

test('default extraction returns without a second provider request on success', async () => {
  let calls = [];
  const output = await withYoutubeFallback({ platform: 'youtube', run: async p => { calls.push(p); return 'ok'; } });
  assert.deepEqual(output, { result: 'ok', profile: 'default' });
  assert.deepEqual(calls, ['default']);
});

test('YouTube bot challenge retries embedded client exactly once', async () => {
  const calls = [];
  const output = await withYoutubeFallback({platform: 'youtube', run: async p => { calls.push(p); if (p === 'default') throw blocked; return 'embedded-ok'; }});
  assert.deepEqual(calls, ['default','embedded']);
  assert.deepEqual(output, {result: 'embedded-ok', profile: 'embedded'});
});

test('does not retry other platforms, private videos, or playlists', async () => {
  for (const options of [
    { platform: 'facebook', err: blocked },
    { platform: 'youtube', playlist: true, err: blocked },
    { platform: 'youtube', err: Object.assign(new Error('denied'), {stderr:'Private video'}) },
  ]) {
    const calls = [];
    await assert.rejects(withYoutubeFallback({...options, run: async p => { calls.push(p); throw options.err; }}));
    assert.deepEqual(calls, ['default']);
  }
});

test('does not endlessly retry when embedded extraction also fails', async () => {
  const calls = [];
  await assert.rejects(withYoutubeFallback({platform:'youtube', run: async p => {calls.push(p);throw blocked;}}), blocked);
  assert.deepEqual(calls, ['default','embedded']);
});
