import 'dotenv/config';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { createBridgeSecret, createBridgeToken, newPairingCode, isBrowserExtensionOrigin, isLocalClient, matchesSecret, ticketFor, ticketValid, safeDownloadName } from './lib/extension-security.js';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT, validateStartup } from './lib/config.js';
import { cookieValue, verifySession, verifyPassword, makeSession, setSessionCookie, clearSessionCookie } from './lib/auth.js';
import { runBinary } from './lib/process.js';
import { metadataForClient, friendlyError } from './lib/metadata.js';
import { downloadDirect, validateDirectUrl } from './lib/direct.js';
import { findPlatform, userError, PLATFORMS, playlistForClient } from './validation.js';

validateStartup();
const app = express();
const DIST = path.join(ROOT, 'dist');
const MANIFEST = path.join(config.downloadDir, 'ready-jobs.json');
const maxBytes = config.maxDownloadMB * 1024 * 1024;
const maxStorageBytes = config.maxTotalMB * 1024 * 1024;
const jobs = new Map();
const queue = [];
const controllers = new Map();
const readers = new Map();
let active = 0;
let inspections = 0;
let stopping = false;
let manifestWrites = Promise.resolve();

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  if (process.env.NODE_ENV === 'production') {
    res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data:; connect-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; frame-src https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});

function requireXHR(req, res, next) {
  // Custom header forces a CORS preflight on cross-origin browser requests.
  // SameSite=Strict cookies and no CORS headers provide additional protection.
  if (req.get('X-Clipora-Request') !== '1' || req.get('Sec-Fetch-Site') === 'cross-site') {
    return res.status(403).json({ error: 'Request origin is not permitted.' });
  }
  next();
}
function authenticate(req, res, next) {
  if (!config.accessPassword || verifySession(cookieValue(req), config.sessionSecret)) return next();
  return res.status(401).json({ error: 'Sign in to use the downloader.', code: 'AUTH_REQUIRED' });
}
function limited(windowMs, limit) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Try again later.' } });
}
const loginLimiter = limited(15 * 60000, 8);
const inspectLimiter = limited(15 * 60000, 25);
const downloadLimiter = limited(60 * 60000, 10);

app.get('/api/health', (_req, res) => res.json({ ok: !stopping }));
app.get('/api/auth', (req, res) => res.json({ required: Boolean(config.accessPassword), authenticated: !config.accessPassword || verifySession(cookieValue(req), config.sessionSecret) }));
app.post('/api/login', requireXHR, loginLimiter, (req, res) => {
  if (!config.accessPassword) return res.json({ authenticated: true });
  if (!verifyPassword(req.body?.password, config.accessPassword)) return res.status(401).json({ error: 'Incorrect access password.' });
  setSessionCookie(res, makeSession(config.sessionSecret), req);
  res.json({ authenticated: true });
});
app.post('/api/logout', requireXHR, (req, res) => { clearSessionCookie(res, req); res.json({ authenticated: false }); });
// Extension bridge: available only from the same computer, with an explicit pairing code.
// The browser extension does NOT inherit web-site cookie sessions.
const bridgeCode = newPairingCode();
const bridgeKey = createBridgeSecret();
const bridgeSessions = new Map();
const extensionLimiter = limited(60 * 60000, 50);
const pairingLimiter = limited(15 * 60000, 8);
app.use('/api/extension', (req, res, next) => {
  if (!['127.0.0.1', 'localhost', '::1'].includes(config.host) || !isLocalClient(req.socket.remoteAddress)) {
    return res.status(403).json({ error: 'The extension bridge is local-only.' });
  }
  const origin = req.get('Origin');
  if (isBrowserExtensionOrigin(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Clipora-Token');
    res.set('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return isBrowserExtensionOrigin(origin) ? res.sendStatus(204) : res.sendStatus(403);
  next();
});
app.post('/api/extension/pair', pairingLimiter, (req, res) => {
  if (!isBrowserExtensionOrigin(req.get('Origin')) || !matchesSecret(req.body?.code, bridgeCode)) {
    return res.status(401).json({ error: 'Incorrect pairing code. Check the terminal running Clipora.' });
  }
  const token = createBridgeToken();
  bridgeSessions.set(token, { origin: req.get('Origin'), issued: Date.now() });
  res.json({ token, paired: true });
});
function requireExtension(req, res, next) {
  const origin = req.get('Origin');
  const token = req.get('X-Clipora-Token');
  const session = token && bridgeSessions.get(token);
  if (!isBrowserExtensionOrigin(origin) || !session || session.origin !== origin || Date.now() - session.issued > 24 * 3600000) {
    return res.status(401).json({ error: 'Extension disconnected. Re-pair using the code shown by Clipora.' });
  }
  next();
}
app.post('/api/extension/inspect', requireExtension, extensionLimiter, async (req, res, next) => {
  if (inspections >= config.maxInspects) return next(userError('Metadata inspection is busy.', 429));
  inspections++;
  try { const { url, platform } = findPlatform(req.body?.url); res.json(await inspect(url, platform)); }
  catch (e) { next(e); }
  finally { inspections--; }
});
app.post('/api/extension/download', requireExtension, extensionLimiter, async (req, res, next) => {
  try {
    if (stopping) throw userError('Downloader is shutting down.', 503);
    if (queue.length >= config.maxQueued) throw userError('Download queue is full.', 429);
    if (await storageBytes() >= maxStorageBytes - maxBytes) throw userError('Local storage quota is nearly full.', 507);
    const input = validatedJobInput(req.body);
    // Direct media is downloaded by Chrome itself; no duplicate server copy.
    if (input.platform === 'direct') return res.json({ mode: 'direct', url: input.url });
    const job = newJob(input);
    const expiry = Date.now() + Math.min(25 * 3600000, config.jobTimeout + 30 * 60000);
    const ticket = ticketFor(job.id, bridgeKey, expiry);
    void pump();
    res.status(202).json({ mode: 'browser', job: publicJob(job),
      url: `http://127.0.0.1:${config.port}/api/extension/file/${job.id}?ticket=${ticket}` });
  } catch (e) { next(e); }
});
app.post('/api/extension/download/batch', requireExtension, extensionLimiter, async (req, res, next) => {
  try {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > config.maxPlaylistItems) throw userError('Select a valid playlist selection.');
    if (items.length + queue.length + active > config.maxQueued + config.maxConcurrent) throw userError('Not enough space in the queue.', 429);
    if (await storageBytes() >= maxStorageBytes - maxBytes) throw userError('Storage quota reached.', 507);
    const entries = items.map(validatedJobInput);
    if (entries.some(item => item.platform !== 'youtube')) throw userError('Only YouTube playlist items are accepted in batch mode.');
    const expiry = Date.now() + Math.min(25 * 3600000, config.jobTimeout + 30 * 60000);
    const downloads = entries.map(newJob).map(job => ({ mode: 'browser', job: publicJob(job),
      url: `http://127.0.0.1:${config.port}/api/extension/file/${job.id}?ticket=${ticketFor(job.id, bridgeKey, expiry)}` }));
    void pump(); res.status(202).json({ downloads });
  } catch (e) { next(e); }
});
app.get('/api/extension/jobs/:id', requireExtension, (req, res, next) => {
  const job = jobs.get(req.params.id);
  if (!job) return next(userError('Download no longer exists.', 404));
  res.json(publicJob(job));
});
app.post('/api/extension/jobs/:id/cancel', requireExtension, (req, res, next) => {
  const job = jobs.get(req.params.id);
  if (!job) return next(userError('Download no longer exists.', 404));
  if (job.status === 'queued') {
    const index = queue.indexOf(job); if (index !== -1) queue.splice(index, 1);
    job.status = 'cancelled'; job.updatedAt = Date.now();
  } else if (job.status === 'downloading') {
    controllers.get(job.id)?.abort(); job.status = 'cancelled'; job.updatedAt = Date.now();
  }
  res.json(publicJob(job));
});
app.get('/api/extension/file/:id', async (req, res, next) => {
  const job = jobs.get(req.params.id);
  if (!job || !ticketValid(req.params.id, req.query.ticket, bridgeKey)) return next(userError('Invalid or expired download ticket.', 403));
  const name = safeDownloadName(job.title, job.type === 'mp3' ? 'mp3' : 'mp4');
  res.status(200).set({ 'Content-Type': job.type === 'mp3' ? 'audio/mpeg' : 'video/mp4',
    'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"`,
    'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  // Send download headers immediately so Chrome creates a native Downloads entry.
  // During extraction Chrome may show unknown byte progress; the extension tracks yt-dlp %.
  res.flushHeaders();
  let closed = false;
  res.on('close', () => {
    closed = true;
    // Cancelling in Chrome also cancels an in-progress yt-dlp task.
    if (job.status === 'downloading') controllers.get(job.id)?.abort();
    if (job.status === 'queued') {
      const i = queue.indexOf(job); if (i !== -1) queue.splice(i, 1);
      job.status = 'cancelled'; job.updatedAt = Date.now();
    }
  });
  while (!closed && !['ready', 'error', 'cancelled'].includes(job.status)) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (closed) return;
  if (job.status !== 'ready') return res.destroy(new Error(job.error || 'Unable to prepare download.'));
  try {
    const file = path.join(config.downloadDir, job.id, job.fileName);
    const details = await stat(file);
    if (!details.isFile()) throw new Error('Output file not found.');
    readers.set(job.id, (readers.get(job.id) || 0) + 1);
    const stream = fs.createReadStream(file);
    stream.on('error', error => res.destroy(error));
    res.once('close', () => {
      stream.destroy(); const n = (readers.get(job.id) || 1) - 1;
      if (n) readers.set(job.id, n); else readers.delete(job.id);
    });
    stream.pipe(res);
  } catch(e) { res.destroy(e); }
});

app.use('/api', authenticate);

function downloaderArgs() {
  return [
    '--ignore-config', '--no-playlist', '--js-runtimes', 'node',
    '--no-warnings', '--socket-timeout', '20', '--retries', '3', '--fragment-retries', '3',
    ...(config.ffmpegLocation ? ['--ffmpeg-location', config.ffmpegLocation] : []),
  ];
}
async function inspect(url, platform) {
  if (platform.key === 'direct') {
    const link = findPlatform(url);
    validateDirectUrl(url);
    return { kind: 'single', platform: 'direct', mediaKind: link.mediaKind, title: decodeURIComponent(new URL(url).pathname.split('/').pop()).slice(0, 200),
      creator: new URL(url).hostname, thumbnail: link.mediaKind === 'image' ? null : null, duration: null, viewCount: null,
      resolutions: link.mediaKind === 'video' ? [0] : [], sourceUrl: url, sourceFormat: link.ext.slice(1) };
  }
  const isPlaylist = platform.key === 'youtube' && findPlatform(url).playlist;
  const result = await runBinary(config.ytdlp,
    [...downloaderArgs().filter(arg => !(isPlaylist && arg === '--no-playlist')),
      ...(isPlaylist ? ['--yes-playlist', '--flat-playlist', '--playlist-end', String(config.maxPlaylistItems)] : []),
      '--dump-single-json', '--skip-download', '--', url],
    { timeoutMs: config.inspectTimeout, outputLimit: 24 * 1024 * 1024 });
  let meta;
  try { meta = JSON.parse(result.output); }
  catch { throw userError('The provider returned invalid metadata.', 502); }
  if (isPlaylist) return playlistForClient(meta, platform, url, config.maxPlaylistItems);
  return { kind: 'single', ...metadataForClient(meta, platform, url, config.maxDuration) };
}
app.post('/api/inspect', requireXHR, inspectLimiter, async (req, res, next) => {
  if (inspections >= config.maxInspects) return next(userError('The server is busy inspecting other links. Try again.', 429));
  inspections++;
  try {
    const { url, platform } = findPlatform(req.body?.url);
    validatePlatform(req.body?.platform, platform);
    res.json(await inspect(url, platform));
  } catch (error) { next(error); }
  finally { inspections--; }
});
function validatePlatform(requested, actual) {
  if (requested && requested !== 'auto' && requested !== actual.key) throw userError(`The link belongs to ${actual.name}. Choose Auto detect or the correct platform.`);
}
function publicJob(job) {
  return {
    id: job.id, status: job.status, progress: job.progress,
    speed: job.speed, eta: job.eta, error: job.error,
    sizeBytes: job.sizeBytes, createdAt: job.createdAt, updatedAt: job.updatedAt,
    title: job.title || 'Untitled', platform: job.platform || 'direct', collection: job.collection || null,
    type: job.type, height: job.height, audioBitrate: job.audioBitrate,
    downloadUrl: job.status === 'ready' ? `/api/files/${job.id}` : null,
  };
}
async function storageBytes() {
  let total = 0;
  for (const item of await readdir(config.downloadDir, { withFileTypes: true })) {
    if (!item.isDirectory() || !/^[\da-f-]{36}$/.test(item.name)) continue;
    const dir = path.join(config.downloadDir, item.name);
    for (const file of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (file.isFile()) total += (await stat(path.join(dir, file.name)).catch(() => ({ size: 0 }))).size;
    }
  }
  return total;
}
app.get('/api/diagnostics', async (_req, res) => {
  const checks = await Promise.all([
    versionOf(config.ytdlp, '--version'),
    versionOf(config.ffmpegLocation ? path.join(config.ffmpegLocation, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg') : 'ffmpeg', '-version'),
    versionOf(config.ffmpegLocation ? path.join(config.ffmpegLocation, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe') : 'ffprobe', '-version'),
  ]);
  res.json({ node: process.version, ytDlp: checks[0], ffmpeg: checks[1], ffprobe: checks[2], active, queued: queue.length });
});
async function versionOf(cmd, flag) {
  try { const r = await runBinary(cmd, [flag], { timeoutMs: 5000, outputLimit: 65536 }); return { installed: true, version: r.output.split(/\r?\n/)[0].slice(0, 90) }; }
  catch { return { installed: false }; }
}
app.get('/api/jobs', (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
  res.json({ jobs: [...jobs.values()].sort((a,b) => b.createdAt - a.createdAt).slice(0, limit).map(publicJob) });
});
function validatedJobInput(input) {
  const { url, platform, mediaKind } = findPlatform(input?.url);
  validatePlatform(input?.platform, platform);
  if (platform.key === 'youtube' && findPlatform(url).playlist) throw userError('Select an individual video from the playlist first.');
  const type = input?.type;
  if (!['mp3', 'mp4', 'original'].includes(type)) throw userError('Choose MP4, MP3, or original media.');
  if (platform.key === 'direct' && type !== 'original') throw userError('Choose original file for direct media URLs.');
  if (platform.key !== 'direct' && type === 'original') throw userError('Original file is only for direct image, audio, or video links.');
  const height = Number(input?.height);
  if (type === 'mp4' && (!Number.isInteger(height) || height < 144 || height > 8640)) throw userError('Choose a valid video resolution.');
  const audioBitrate = Number(input?.audioBitrate || 192);
  if (type === 'mp3' && ![64, 96, 128, 160, 192, 256, 320].includes(audioBitrate)) throw userError('Choose a valid MP3 bitrate.');
  const title = typeof input?.title === 'string' ? input.title.slice(0, 200).trim() : '';
  const collection = typeof input?.collection === 'string' ? input.collection.slice(0, 100).trim() : '';
  return { url, platform: platform.key, type, height: type === 'mp4' ? height : null,
    audioBitrate: type === 'mp3' ? audioBitrate : null, title: title || (mediaKind ? `Direct ${mediaKind}` : 'Video'), collection };
}
function newJob(input) {
  const id = randomUUID(); const now = Date.now();
  const job = { id, ...input, status: 'queued', progress: 0, speed: null, eta: null, error: null,
    fileName: null, sizeBytes: null, createdAt: now, updatedAt: now };
  jobs.set(id, job); queue.push(job); return job;
}
app.post('/api/download/batch', requireXHR, downloadLimiter, async (req, res, next) => {
  try {
    if (stopping) throw userError('Server is shutting down.', 503);
    const requested = req.body?.items;
    if (!Array.isArray(requested) || requested.length === 0 || requested.length > config.maxPlaylistItems) throw userError('Select 1–' + config.maxPlaylistItems + ' videos.');
    if (requested.length + queue.length + active > config.maxQueued + config.maxConcurrent) throw userError('Not enough queue space. Download fewer videos.', 429);
    if (await storageBytes() > maxStorageBytes - maxBytes) throw userError('Server storage is nearly full.', 507);
    const entries = requested.map(validatedJobInput);
    if (entries.some(entry => entry.platform !== 'youtube')) throw userError('Batch mode currently supports selected YouTube playlist videos only.');
    const queued = entries.map(newJob);
    void pump(); res.status(202).json({ jobs: queued.map(publicJob) });
  } catch (error) { next(error); }
});
app.post('/api/download', requireXHR, downloadLimiter, async (req, res, next) => {
  try {
    if (stopping) throw userError('Server is shutting down.', 503);
    const input = validatedJobInput(req.body);
    if (queue.length >= config.maxQueued) throw userError('The queue is full. Please try later.', 429);
    if (await storageBytes() >= maxStorageBytes - maxBytes) throw userError('Server storage quota is nearly full. Try later.', 507);
    const job = newJob(input);
    void pump(); res.status(202).json(publicJob(job));
  } catch (error) { next(error); }
});
app.get('/api/jobs/:id', (req, res, next) => {
  const job = jobs.get(req.params.id);
  if (!job) return next(userError('The job was not found or has expired.', 404));
  res.json(publicJob(job));
});
app.post('/api/jobs/:id/cancel', requireXHR, async (req, res, next) => {
  const job = jobs.get(req.params.id);
  if (!job) return next(userError('The job was not found or has expired.', 404));
  if (job.status === 'queued') {
    const index = queue.findIndex(j => j.id === job.id);
    if (index !== -1) queue.splice(index, 1);
    job.status = 'cancelled'; job.updatedAt = Date.now();
  } else if (job.status === 'downloading') {
    controllers.get(job.id)?.abort();
    job.status = 'cancelled'; job.updatedAt = Date.now();
  }
  res.json(publicJob(job));
});
function pump() {
  while (!stopping && active < config.maxConcurrent && queue.length) {
    const job = queue.shift();
    active++;
    void processDownload(job).finally(() => { active--; void pump(); });
  }
}
async function processDownload(job) {
  const folder = path.join(config.downloadDir, job.id);
  const controller = new AbortController();
  controllers.set(job.id, controller);
  job.status = 'downloading'; job.updatedAt = Date.now();
  let quotaWatcher;
  try {
    await mkdir(folder, { recursive: true });
    // Never trust a client-supplied quality/duration without rechecking the source.
    const { platform, ext: directExt } = findPlatform(job.url);
    if (platform.key === 'direct') {
      const dest = path.join(folder, `video${directExt}`);
      const info = await downloadDirect(job.url, dest, maxBytes, { signal: controller.signal, onProgress: n => { job.progress = n; job.updatedAt = Date.now(); } });
      job.fileName = `video${directExt}`; job.sizeBytes = info.size; job.status = 'ready'; job.progress = 100; job.updatedAt = Date.now();
      await saveManifest();
      return;
    }
    const metadata = await inspect(job.url, platform);
    if (job.type === 'mp4' && !metadata.resolutions.some(h => h <= job.height)) {
      throw userError('The chosen quality is no longer available.', 422);
    }
    if (controller.signal.aborted) throw userError('Download was cancelled.', 409);
    let diskCheckRunning = false;
    quotaWatcher = setInterval(async () => {
      if (diskCheckRunning) return;
      diskCheckRunning = true;
      try { if ((await folderBytes(folder) > maxBytes * 1.65) || (await storageBytes() > maxStorageBytes)) controller.abort(); }
      catch (e) { console.error('Quota monitor:', e.message); }
      finally { diskCheckRunning = false; }
    }, 2500);
    const args = [
      ...downloaderArgs(), '--newline', '--max-filesize', `${config.maxDownloadMB}M`,
      '--match-filter', `duration <= ${config.maxDuration} & !is_live`,
      '--output', path.join(folder, 'video.%(ext)s'),
      '--progress-template', 'download:CLIPORA_PROGRESS|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    ];
    if (job.type === 'mp3') args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', `${job.audioBitrate || 192}K`);
    else args.push(
      '-f', `bv[height<=${job.height}][ext=mp4]+ba[ext=m4a]/b[height<=${job.height}][ext=mp4]/bv[height<=${job.height}]+ba/b[height<=${job.height}]`,
      '--merge-output-format', 'mp4', '--remux-video', 'mp4',
    );
    args.push('--', job.url);
    await runBinary(config.ytdlp, args, {
      timeoutMs: config.jobTimeout,
      outputLimit: 16 * 1024 * 1024,
      signal: controller.signal,
      onLine(line) {
        const match = /CLIPORA_PROGRESS\|\s*([\d.]+)%\s*\|\s*([^|]*)\|\s*(.*)/.exec(line);
        if (match) {
          const n = Number(match[1]);
          if (Number.isFinite(n)) job.progress = Math.max(job.progress, Math.min(98, n));
          job.speed = match[2].trim().slice(0, 40) || null;
          job.eta = match[3].trim().slice(0, 40) || null;
          job.updatedAt = Date.now();
        }
      },
    });
    if (controller.signal.aborted) throw userError('Download was cancelled.', 409);
    const files = await readdir(folder);
    const expectedExt = job.type === 'mp3' ? '.mp3' : '.mp4';
    const matched = files.find(f => /^video\.[\w.-]+$/i.test(f) && f.toLowerCase().endsWith(expectedExt));
    if (!matched) throw userError('The extractor could not create the requested format.', 422);
    const file = path.join(folder, matched);
    const details = await stat(file);
    if (!details.isFile() || !details.size) throw userError('No completed video file was produced.', 502);
    if (details.size > maxBytes) throw userError('The final file exceeds the server limit.', 413);
    job.fileName = matched;
    job.sizeBytes = details.size;
    job.status = 'ready'; job.progress = 100; job.updatedAt = Date.now();
    await saveManifest();
  } catch (error) {
    job.status = job.status === 'cancelled' || controller.signal.aborted ? 'cancelled' : 'error';
    job.error = job.status === 'cancelled' ? 'Download was cancelled.' : error.status ? error.message : friendlyError(error, config.maxDownloadMB);
    job.updatedAt = Date.now();
    await rm(folder, { recursive: true, force: true }).catch(() => {});
  } finally {
    if (quotaWatcher) clearInterval(quotaWatcher);
    controllers.delete(job.id);
  }
}
async function folderBytes(folder) {
  let n = 0;
  for (const entry of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
    if (entry.isFile()) n += (await stat(path.join(folder, entry.name)).catch(() => ({ size: 0 }))).size;
  }
  return n;
}
app.get('/api/files/:id', async (req, res, next) => {
  try {
    const job = jobs.get(req.params.id);
    if (!job || job.status !== 'ready' || !job.fileName) throw userError('This file has expired.', 404);
    const file = path.join(config.downloadDir, job.id, job.fileName);
    const s = await stat(file);
    if (!s.isFile()) throw userError('The file cannot be found.', 404);
    readers.set(job.id, (readers.get(job.id) || 0) + 1);
    res.set('Cache-Control', 'private, no-store');
    const name = (job.title || 'clipora').normalize('NFKC').replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 90).replace(/^[._ ]+|[._ ]+$/g, '') || 'clipora';
    res.download(file, `${name}${path.extname(file)}`, error => {
      const n = (readers.get(job.id) || 1) - 1;
      if (n) readers.set(job.id, n); else readers.delete(job.id);
      if (error && !res.headersSent) next(error);
    });
  } catch (error) { next(error); }
});
function saveManifest() {
  manifestWrites = manifestWrites.catch(() => {}).then(writeManifest);
  return manifestWrites;
}
async function writeManifest() {
  const available = [...jobs.values()].filter(j => j.status === 'ready').map(j => ({
    id: j.id, type: j.type, status: j.status, fileName: j.fileName, sizeBytes: j.sizeBytes,
    title: j.title, platform: j.platform, collection: j.collection, height: j.height, audioBitrate: j.audioBitrate,
    createdAt: j.createdAt, updatedAt: j.updatedAt,
  }));
  const temp = `${MANIFEST}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(available), { mode: 0o600 });
  await rename(temp, MANIFEST);
}
async function restoreAndClean() {
  await mkdir(config.downloadDir, { recursive: true });
  let available = [];
  try { available = JSON.parse(await readFile(MANIFEST, 'utf8')); } catch { /* no manifest */ }
  const valid = new Set();
  for (const record of Array.isArray(available) ? available : []) {
    if (!/^[\da-f-]{36}$/.test(record?.id || '') || !/^video\.[\w.-]+$/.test(record?.fileName || '')) continue;
    if (Date.now() - record.updatedAt > config.ttl) continue;
    try {
      const s = await stat(path.join(config.downloadDir, record.id, record.fileName));
      if (!s.isFile()) continue;
      jobs.set(record.id, { ...record, status: 'ready', progress: 100, sizeBytes: s.size, speed: null, eta: null, error: null });
      valid.add(record.id);
    } catch { /* stale metadata */ }
  }
  for (const entry of await readdir(config.downloadDir, { withFileTypes: true })) {
    if (entry.isDirectory() && /^[\da-f-]{36}$/.test(entry.name) && !valid.has(entry.name)) {
      await rm(path.join(config.downloadDir, entry.name), { recursive: true, force: true }).catch(() => {});
    }
  }
  await saveManifest();
}
async function cleanup() {
  const cutoff = Date.now() - config.ttl;
  let changed = false;
  for (const [id, job] of jobs) {
    if (job.status === 'queued' || job.status === 'downloading' || readers.has(id) || job.updatedAt > cutoff) continue;
    jobs.delete(id);
    changed = true;
    await rm(path.join(config.downloadDir, id), { recursive: true, force: true }).catch(() => {});
  }
  if (changed) await saveManifest();
}
setInterval(() => { void cleanup().catch(e => console.error('Cleanup error:', e.message)); }, 5 * 60000).unref();

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false }));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
}
app.use((err, _req, res, _next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status
    : err.code === 'ENOENT' ? 503 : err.code === 'TIMEOUT' ? 504 : 500;
  if (status >= 500) console.error('API error:', err.message);
  res.status(status).json({ error: status === 500 ? 'Server error. Review server logs.' : status === 503 && err.code === 'ENOENT' ? 'yt-dlp is missing. Run the Windows setup script or npm run doctor.' : err.status ? err.message : friendlyError(err, config.maxDownloadMB) });
});
await restoreAndClean();
const listener = app.listen(config.port, config.host, () => {
  console.log(`Clipora listening on http://${config.host}:${config.port} (${config.accessPassword ? 'password-protected' : 'local-only'})`);
  if (['127.0.0.1', 'localhost', '::1'].includes(config.host)) console.log(`\n  CLIPORA CHROME EXTENSION PAIRING CODE: ${bridgeCode}\n  Enter this code in the extension once after starting Clipora.\n`);
});
function shutdown() {
  stopping = true;
  for (const controller of controllers.values()) controller.abort();
  listener.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
