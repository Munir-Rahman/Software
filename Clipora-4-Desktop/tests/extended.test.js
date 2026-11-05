import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPlatform, playlistForClient, youtubeEntryUrl } from '../server/validation.js';
import { isPublicIPv4, validateDirectUrl } from '../server/lib/direct.js';

test('new media sources and playlist recognition', () => {
  assert.equal(findPlatform('https://www.linkedin.com/posts/example').platform.key, 'linkedin');
  assert.equal(findPlatform('https://www.coursera.org/learn/example/lecture/123').platform.key, 'coursera');
  assert.equal(findPlatform('https://www.youtube.com/playlist?list=PLabcdef').playlist, true);
  assert.equal(findPlatform('https://www.youtube.com/watch?v=01234567890&list=PLabcd').playlist, true);
  assert.equal(findPlatform('https://cdn.example.org/photo.png').mediaKind, 'image');
});
test('playlist entries use canonical sanitized youtube URLs', () => {
  assert.equal(youtubeEntryUrl({ id: 'aBcD_123-xy' }), 'https://www.youtube.com/watch?v=aBcD_123-xy');
  assert.equal(youtubeEntryUrl({ id: 'bad&redirect=evil' }), null);
  const list = playlistForClient({title:'Course', entries:[{ id:'aBcD_123-xy', title:'Lesson 1' },{ id:'bad' }] }, {key:'youtube'}, 'https://www.youtube.com/playlist?list=abc');
  assert.equal(list.items.length,1);
});
test('direct URLs reject internal hosts and unsafe redirects targets', () => {
  for (const url of ['https://127.0.0.1/a.jpg','http://cdn.example.com/a.png','https://localhost/x.jpg','https://cdn.example.com/f.html','https://name:secret@cdn.example.com/a.mp4']) assert.throws(() => validateDirectUrl(url));
  for (const ip of ['127.0.0.1','169.254.169.254','10.2.3.4','192.168.1.2','172.31.1.1','100.64.0.1','203.0.113.1']) assert.equal(isPublicIPv4(ip),false);
  assert.equal(isPublicIPv4('8.8.8.8'), true);
});
