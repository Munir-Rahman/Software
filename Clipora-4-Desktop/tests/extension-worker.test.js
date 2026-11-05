import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('Chrome extension starts a direct image without opening the Clipora website', async () => {
  const script = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../browser-extension/service-worker.js'), 'utf8');
  let listener;
  const downloads = [];
  const chrome = {
    runtime: { onMessage: { addListener(cb) { listener = cb; } }, onInstalled: { addListener() {} } },
    contextMenus: { create() {}, onClicked: { addListener() {} } },
    storage: { local: { async get() { return {}; }, async set() {}, async remove() {} } },
    downloads: { async download(options) { downloads.push(options); return 42; }, onChanged: { addListener() {} } },
    tabs: { create() { throw new Error('Should never open Clipora web!'); } },
  };
  vm.runInNewContext(script, { chrome, URL, console, fetch, setTimeout, Promise });
  const response = await new Promise(resolve => {
    const accepted = listener({ action: 'quick', url: 'https://cdn.example.org/photo.jpg', kind: 'image' }, {}, resolve);
    assert.equal(accepted, true);
  });
  assert.equal(response.ok, true);
  assert.equal(response.data.downloadId, 42);
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].url, 'https://cdn.example.org/photo.jpg');
  assert.match(downloads[0].filename, /^Clipora\/Images\/photo\.jpg$/);
  assert.equal(downloads[0].saveAs, false);
});

test('Chrome extension queues converted video and opens a native download immediately', async () => {
  const script = fs.readFileSync(new URL('../browser-extension/service-worker.js', import.meta.url), 'utf8');
  let listener;
  const saved = { cliporaToken: 'test-token', cliporaJobs: [] };
  const native = [];
  const chrome = {
    runtime: { onMessage: { addListener(cb) { listener = cb; } }, onInstalled: { addListener() {} } },
    contextMenus: { create() {}, onClicked: { addListener() {} } },
    storage: { local: { async get() { return saved; }, async set(values) { Object.assign(saved, values); }, async remove(key) { delete saved[key]; } } },
    downloads: { async download(options) { native.push(options); return 5; }, onChanged: { addListener() {} } },
  };
  const fetchMock = async (url, options) => {
    assert.ok(url.endsWith('/download'));
    assert.equal(options.headers['X-Clipora-Token'], 'test-token');
    return { ok: true, json: async () => ({ mode: 'browser', job: { id: 'abc', title: 'Demo', type: 'mp4' }, url: 'http://127.0.0.1:3001/api/extension/file/abc?ticket=test' }) };
  };
  vm.runInNewContext(script, { chrome, URL, console, fetch: fetchMock, setTimeout, Promise });
  const response = await new Promise(resolve => listener({ action: 'start', payload: { url: 'https://youtu.be/abc12345678', type: 'mp4', height: 720 } }, {}, resolve));
  assert.equal(response.ok, true);
  assert.equal(response.data.downloadId, 5);
  assert.equal(native.length, 1);
  assert.match(native[0].filename, /Clipora\/Videos\/Demo\.mp4/);
  assert.equal(saved.cliporaJobs[0].chromeDownloadId, 5);
});
