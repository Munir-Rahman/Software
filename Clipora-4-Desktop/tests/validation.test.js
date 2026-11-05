import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findPlatform } from '../server/validation.js';

describe('supported URLs', () => {
  it('recognizes Youtube, TikTok, and short domains', () => {
    assert.equal(findPlatform('https://www.youtube.com/watch?v=test').platform.key, 'youtube');
    assert.equal(findPlatform('https://vm.tiktok.com/example/').platform.key, 'tiktok');
    assert.equal(findPlatform('https://youtu.be/abc123').platform.key, 'youtube');
    assert.equal(findPlatform('https://fb.watch/shortname/').platform.key, 'facebook');
  });
  it('rejects common malicious or invalid hostnames', () => {
    for (const url of [
      'http://127.0.0.1/admin',
      'http://10.0.0.10/latest/meta-data',
      'http://169.254.169.254/latest/meta-data',
      'http://youtube.com.evil.test/video',
      'http://evil-youtube.com/video',
      'file:///etc/passwd',
      'https://user:password@youtube.com/video',
      'https://youtube.com:9999/video',
      'javascript:alert(1)',
      'https://youtube.com/',
    ]) assert.throws(() => findPlatform(url));
  });
});
