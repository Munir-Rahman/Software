/* Clipora desktop bridge. No server-side downloads run in the extension sandbox. */
const API = 'http://127.0.0.1:3001/api/extension';
const AUDIO_RATES = [64, 96, 128, 160, 192, 256, 320];
const MEDIA_EXTENSIONS = /\.(mp4|m4v|mov|webm|mp3|m4a|wav|ogg|jpg|jpeg|png|webp|gif)(?:$|[?#])/i;

function safeRemoteUrl(value) {
  const u = new URL(value);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || (u.protocol === 'http:' && u.hostname !== '127.0.0.1')) {
    throw new Error('Use a regular HTTPS media URL.');
  }
  return u.href;
}
function safeFileName(input, extension = 'mp4') {
  const clean = String(input || 'media').normalize('NFKC')
    .replace(/[\\/\x00-\x1f:*?"<>|]/g, ' ').replace(/[^\p{L}\p{N}._ ()-]/gu, '_')
    .trim().slice(0, 90).replace(/^[. ]+|[. ]+$/g, '') || 'media';
  return `${clean}.${extension}`;
}
function detectExt(url, kind) {
  const ext = /\.([a-z0-9]{2,5})$/i.exec(new URL(url).pathname)?.[1]?.toLowerCase();
  if (ext && /^(mp4|m4v|mov|webm|mp3|m4a|wav|ogg|jpg|jpeg|png|webp|gif)$/.test(ext)) return ext;
  return kind === 'image' ? 'jpg' : kind === 'audio' ? 'mp3' : 'mp4';
}
function typeFolder(kind) { return kind === 'image' ? 'Images' : kind === 'audio' ? 'Audio' : 'Videos'; }
function directInfo(url, kind) {
  const uri = new URL(url);
  const ext = detectExt(url, kind);
  const fromPath = decodeURIComponent(uri.pathname.split('/').at(-1) || 'media').replace(/\.[a-z0-9]{2,5}$/i, '') || 'media';
  return { ext, name: fromPath, kind: kind || (/^(png|jpe?g|webp|gif)$/.test(ext) ? 'image' : /^(mp3|m4a|wav|ogg)$/.test(ext) ? 'audio' : 'video') };
}
async function bridge(endpoint, options = {}) {
  const { cliporaToken } = await chrome.storage.local.get('cliporaToken');
  if (!cliporaToken && endpoint !== '/pair') throw new Error('Connect to your desktop Clipora server using its pairing code first.');
  let response;
  try {
    response = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cliporaToken ? { 'X-Clipora-Token': cliporaToken } : {}) },
      body: JSON.stringify(options),
    });
  } catch { throw new Error('Clipora is not running. Start START-CLIPORA.cmd on this computer.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/pair') await chrome.storage.local.remove('cliporaToken');
    throw new Error(data.error || `Clipora server returned ${response.status}.`);
  }
  return data;
}
async function pair(code) {
  if (!/^\d{8}$/.test(String(code || ''))) throw new Error('Enter the eight-digit code shown in your Clipora terminal.');
  const result = await bridge('/pair', { code: String(code) });
  await chrome.storage.local.set({ cliporaToken: result.token });
  return { paired: true };
}
async function downloadFile(url, { title, kind, saveAs = false } = {}) {
  const safe = safeRemoteUrl(url);
  const info = directInfo(safe, kind);
  const fname = `Clipora/${typeFolder(info.kind)}/${safeFileName(title || info.name, info.ext)}`;
  const id = await chrome.downloads.download({ url: safe, filename: fname, conflictAction: 'uniquify', saveAs });
  if (typeof id !== 'number') throw new Error('Chrome did not start the download.');
  return { downloadId: id, filename: fname, mode: 'direct' };
}
async function trackJob(item, downloadId) {
  const stored = await chrome.storage.local.get('cliporaJobs');
  const jobs = Array.isArray(stored.cliporaJobs) ? stored.cliporaJobs : [];
  const next = [{ id: item.job.id, chromeDownloadId: downloadId, title: item.job.title,
    createdAt: Date.now(), type: item.job.type }, ...jobs.filter(j => j.id !== item.job.id)].slice(0, 40);
  await chrome.storage.local.set({ cliporaJobs: next });
}
async function receiveJob(download) {
  const extension = download.job.type === 'mp3' ? 'mp3' : 'mp4';
  const fname = `Clipora/${extension === 'mp3' ? 'Audio' : 'Videos'}/${safeFileName(download.job.title, extension)}`;
  // Chrome registers its own download NOW; the local engine prepares the file on disk.
  const downloadId = await chrome.downloads.download({ url: download.url, filename: fname, conflictAction: 'uniquify', saveAs: false });
  if (typeof downloadId !== 'number') throw new Error('Chrome could not start downloading.');
  await trackJob(download, downloadId);
  return { downloadId, jobId: download.job.id, filename: fname, mode: 'browser' };
}
async function start(payload) {
  const url = safeRemoteUrl(payload.url);
  const data = await bridge('/download', { ...payload, url });
  if (data.mode === 'direct') return downloadFile(data.url, { title: payload.title, kind: payload.kind });
  return receiveJob(data);
}
async function quickDownload(rawUrl, kind = '') {
  let url = safeRemoteUrl(rawUrl);
  if (/\.(m3u8|mpd)(?:$|[?#])/i.test(url)) throw new Error('Segmented HLS/DASH manifest is not a complete video file. Use the video page URL in the Clipora extension instead.');
  if (kind && kind !== 'page' && (MEDIA_EXTENSIONS.test(url) || /^(image|video|audio)$/.test(kind))) {
    return downloadFile(url, { kind });
  }
  // The browser's current YouTube watch URL may include playlist query fields.
  const parsed = new URL(url);
  if (/(^|\.)youtube\.com$/.test(parsed.hostname) && parsed.pathname === '/watch') {
    parsed.searchParams.delete('list'); parsed.searchParams.delete('index'); parsed.searchParams.delete('start_radio');
    url = parsed.href;
  }
  const found = await bridge('/inspect', { url });
  if (found.kind !== 'single') throw new Error('This is a playlist. Open Clipora popup to select the videos.');
  if (found.platform === 'direct') return downloadFile(url, { kind });
  const height = (found.resolutions || []).filter(Number.isInteger).filter(h => h >= 144).find(h => h <= 1080)
    || (found.resolutions || []).find(h => Number.isInteger(h) && h >= 144);
  if (!height) throw new Error('No downloadable video quality was reported. Try audio in the extension popup.');
  return start({ url, platform: found.platform, type: 'mp4', height, title: found.title });
}
async function startBatch({ items, type, height, bitrate, collection }) {
  if (!Array.isArray(items) || !items.length) throw new Error('Select at least one playlist video.');
  const response = await bridge('/download/batch', { items: items.map(item => ({
    url: item.url, title: item.title, platform: 'youtube', type,
    height: Number(height || 720), audioBitrate: Number(bitrate || 192), collection,
  })) });
  const started = [];
  for (const item of response.downloads) {
    try { started.push(await receiveJob(item)); }
    catch (e) { started.push({ error: e.message, jobId: item.job.id }); }
  }
  return { downloads: started };
}
async function status() {
  const stored = await chrome.storage.local.get(['cliporaToken', 'cliporaJobs']);
  const pending = (stored.cliporaJobs || []).slice(0, 12);
  const items = await Promise.all(pending.map(async entry => {
    let chromeItem = null;
    try { chromeItem = (await chrome.downloads.search({ id: entry.chromeDownloadId }))[0] || null; } catch { /* removed history */ }
    let job = null;
    if (stored.cliporaToken && chromeItem?.state === 'in_progress') {
      try {
        const response = await fetch(`${API}/jobs/${entry.id}`, {
          headers: { 'X-Clipora-Token': stored.cliporaToken },
        });
        if (response.ok) job = await response.json();
      } catch { /* backend may be closed */ }
    }
    return { ...entry, state: chromeItem?.state || 'missing', received: chromeItem?.bytesReceived ?? 0,
      total: chromeItem?.totalBytes ?? -1, error: chromeItem?.error || job?.error,
      jobStatus: job?.status, jobProgress: job?.progress, jobSpeed: job?.speed, jobEta: job?.eta };
  }));
  return { paired: Boolean(stored.cliporaToken), items };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.action !== 'string') return false;
  const tasks = {
    pair: () => pair(message.code),
    inspect: () => bridge('/inspect', { url: safeRemoteUrl(message.url) }),
    start: () => start(message.payload),
    quick: () => quickDownload(message.url, message.kind || ''),
    batch: () => startBatch(message.payload),
    status: () => status(),
    direct: () => downloadFile(message.url, { kind: message.kind, title: message.title }),
    cancel: async () => {
      const { cliporaToken } = await chrome.storage.local.get('cliporaToken');
      await chrome.downloads.cancel(message.chromeDownloadId);
      if (cliporaToken && message.jobId) await bridge(`/jobs/${message.jobId}/cancel`, {});
      return { cancelled: true };
    },
    scan: async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Open a normal website first.');
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['media-buttons.js'] });
      return { scanned: true };
    },
  };
  if (!tasks[message.action]) return false;
  Promise.resolve().then(tasks[message.action]).then(data => sendResponse({ ok: true, data }))
    .catch(e => sendResponse({ ok: false, error: e.message || String(e) }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'clipora-media', title: 'Download with Clipora', contexts: ['image', 'video', 'audio', 'link', 'page'] });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.srcUrl || info.linkUrl || info.pageUrl || tab?.url;
  if (!url) return;
  const kind = ['image', 'video', 'audio'].includes(info.mediaType) ? info.mediaType : 'page';
  void quickDownload(url, kind).catch(e => { console.warn('Clipora download:', e.message); });
});
