import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeSession, verifySession, verifyPassword } from '../server/lib/auth.js';
import { metadataForClient } from '../server/lib/metadata.js';
import { validateStartup } from '../server/lib/config.js';
import { runBinary } from '../server/lib/process.js';

const secret = 'very-long-secret-that-can-be-set-from-env-2026';
describe('Authentication', () => {
  it('creates and verifies tamper-resistant sessions with expiry', () => {
    const now = 1700000000000;
    const token = makeSession(secret, now);
    assert.equal(verifySession(token, secret, now + 1000), true);
    assert.equal(verifySession(token, 'other-secret', now), false);
    assert.equal(verifySession(token, secret, now + 13 * 3600000), false);
    assert.equal(verifySession(token.slice(0, -1) + 'X', secret, now), false);
  });
  it('compares access passwords', () => {
    assert.equal(verifyPassword('this is the password', 'this is the password'), true);
    assert.equal(verifyPassword('wrong', 'this is the password'), false);
    assert.equal(verifyPassword(null, 'this is the password'), false);
  });
});
describe('Source metadata and safeguards', () => {
  const platform = { key: 'youtube', name: 'YouTube' };
  it('shows actual resolutions only', () => {
    const result = metadataForClient({ title: 'Video', formats: [
      { vcodec: 'avc1', height: 1080 }, { vcodec: 'none', height: 720 },
      { vcodec: 'avc1', height: 720 }, { vcodec: 'avc1', height: 720 },
      { vcodec: 'avc1', height: 480 },
    ] }, platform, 'https://youtu.be/video', 3600);
    assert.deepEqual(result.resolutions, [1080, 720, 480]);
  });
  it('rejects live and over-limit videos', () => {
    assert.throws(() => metadataForClient({ is_live: true }, platform, 'https://youtu.be/x', 3600));
    assert.throws(() => metadataForClient({ duration: 3601 }, platform, 'https://youtu.be/x', 3600));
  });
  it('rejects public server without strong credentials', () => {
    assert.throws(() => validateStartup({ host: '0.0.0.0', accessPassword: '', sessionSecret: '', maxTotalMB: 100, maxDownloadMB: 10 }));
    assert.doesNotThrow(() => validateStartup({ host: '0.0.0.0', accessPassword: 'long secure password', sessionSecret: secret, maxTotalMB: 100, maxDownloadMB: 10 }));
    assert.throws(() => validateStartup({ host: '127.0.0.1', accessPassword: '', sessionSecret: '', maxTotalMB: 5, maxDownloadMB: 10 }));
  });
});
describe('Executable helper', () => {
  it('executes using argument arrays, no shell', async () => {
    const result = await runBinary(process.execPath, ['-e', "process.stdout.write('ok')"]);
    assert.equal(result.output, 'ok');
  });
  it('rejects missing executables', async () => {
    await assert.rejects(runBinary('this-executable-does-not-exist-clipora', [], { timeoutMs: 1000 }));
  });
  it('terminates stalled subprocesses', async () => {
    await assert.rejects(runBinary(process.execPath, ['-e', 'setInterval(() => {},1000)'], { timeoutMs: 200 }), e => e.code === 'TIMEOUT');
  });
});
