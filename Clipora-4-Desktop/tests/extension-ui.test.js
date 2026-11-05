import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../browser-extension/', import.meta.url);

test('YouTube linked thumbnail resolves to the watch URL, never the WebP thumbnail', () => {
  const script = fs.readFileSync(new URL('media-target.js', root), 'utf8');
  const location = { href: 'https://www.youtube.com/@TheCodingTrain', origin: 'https://www.youtube.com' };
  const context = { location, URL };
  vm.runInNewContext(script, context);
  const linked = { href: 'https://www.youtube.com/watch?v=AbCdEf12345&list=PL123' };
  const image = { tagName: 'IMG', currentSrc: 'https://i.ytimg.com/vi/AbCdEf12345/hqdefault.webp', closest: () => linked };
  const result = context.CliporaMediaTarget.resolveMediaTarget(image, location);
  assert.equal(result.kind, 'page');
  assert.equal(result.url, 'https://www.youtube.com/watch?v=AbCdEf12345');
  assert.ok(!result.url.endsWith('.webp'));
});

test('Decorative YouTube images have no download badge and watch-page player uses page URL', () => {
  const context = { location: { href: 'https://www.youtube.com/watch?v=AbCdEf12345', origin: 'https://www.youtube.com' }, URL };
  vm.runInNewContext(fs.readFileSync(new URL('media-target.js', root), 'utf8'), context);
  const decorative = { tagName:'IMG', currentSrc: 'https://yt3.ggpht.com/avatar.webp', closest:()=>null };
  assert.equal(context.CliporaMediaTarget.resolveMediaTarget(decorative, context.location), null);
  const video = { tagName:'VIDEO', currentSrc:'blob:https://www.youtube.com/abc', closest:()=>null };
  assert.equal(context.CliporaMediaTarget.resolveMediaTarget(video, context.location).url, context.location.href);
});

test('Direct image on another site remains an image download', () => {
  const context = { location: { href:'https://example.net/articles', origin:'https://example.net' }, URL };
  vm.runInNewContext(fs.readFileSync(new URL('media-target.js', root), 'utf8'), context);
  const image = { tagName: 'IMG', currentSrc: 'https://example.net/assets/hero.jpg', closest: () => null };
  const target = context.CliporaMediaTarget.resolveMediaTarget(image, context.location);
  assert.equal(target.kind, 'image');
  assert.equal(target.url, 'https://example.net/assets/hero.jpg');
});

test('Extension can inspect and start direct images without a local engine', async () => {
  const script = fs.readFileSync(new URL('service-worker.js', root), 'utf8');
  let listener;
  const saved = {};
  const chrome = {
    runtime: { onMessage: { addListener: fn => listener = fn }, onInstalled: { addListener() {} } },
    contextMenus: { create() {}, onClicked: { addListener() {} } },
    storage: { local: { async get() { return saved; }, async set(data) { Object.assign(saved, data); }, async remove() {} } },
    downloads: { async download() { return 16; } },
  };
  vm.runInNewContext(script, { chrome, URL, fetch: () => { throw new Error('Should not call localhost'); }, setTimeout, Date, console, Promise });
  const call = data => new Promise(resolve => listener(data, {}, resolve));
  const inspected = await call({action:'inspect',url:'https://cdn.example.com/test.png'});
  assert.equal(inspected.ok,true);
  assert.equal(inspected.data.platform,'direct');
  assert.equal(inspected.data.mediaKind,'image');
  const started = await call({action:'start',payload:{url:'https://cdn.example.com/test.png',type:'original',kind:'image'}});
  assert.equal(started.ok,true);
  assert.equal(started.data.downloadId,16);
  assert.equal(saved.cliporaJobs[0].id,'direct:16');
});

test('YouTube right-click opens an extension chooser rather than saving WebP automatically', async () => {
  const script = fs.readFileSync(new URL('service-worker.js', root), 'utf8');
  let click;
  const opened = [];
  const chrome = {
    runtime: { getURL: p => 'chrome-extension://extension123/' + p, onMessage: { addListener() {} }, onInstalled: { addListener() {} } },
    contextMenus: { create() {}, onClicked: { addListener: fn => click = fn } },
    windows: { create(options, done) { opened.push(options); done?.(); } },
    downloads: { async download() { throw new Error('Should not auto-download'); } },
  };
  vm.runInNewContext(script, { chrome, URL, Promise, console, setTimeout });
  click({mediaType: 'image', linkUrl:'https://www.youtube.com/watch?v=AbCdEf12345', srcUrl:'https://i.ytimg.com/a.webp',pageUrl:'https://www.youtube.com/@creator'}, {});
  assert.equal(opened.length, 1);
  assert.equal(opened[0].type,'popup');
  assert.match(opened[0].url,/popup\.html\?url=/);
  assert.ok(!opened[0].url.includes('.webp'));
});
