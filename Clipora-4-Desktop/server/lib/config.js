import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL = path.join(ROOT, 'tools');
const exe = process.platform === 'win32' ? '.exe' : '';
export const numberSetting = (name, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const v = Number(process.env[name]);
  return Number.isSafeInteger(v) && v > 0 ? Math.min(v, max) : fallback;
};
export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: numberSetting('PORT', 3001, 65535),
  downloadDir: path.resolve(process.env.DOWNLOAD_DIR || path.join(ROOT, 'server', 'runtime')),
  ytdlp: process.env.YTDLP_PATH || (fs.existsSync(path.join(TOOL, `yt-dlp${exe}`)) ? path.join(TOOL, `yt-dlp${exe}`) : 'yt-dlp'),
  ffmpegLocation: process.env.FFMPEG_LOCATION || (fs.existsSync(path.join(TOOL, `ffmpeg${exe}`)) ? TOOL : ''),
  maxDownloadMB: numberSetting('MAX_DOWNLOAD_MB', 2048, 65536),
  maxTotalMB: numberSetting('MAX_TOTAL_MB', 10240, 262144),
  maxConcurrent: numberSetting('MAX_CONCURRENT', 2, 8),
  maxQueued: numberSetting('MAX_QUEUED', 30, 200),
  maxPlaylistItems: numberSetting('MAX_PLAYLIST_ITEMS', 25, 100),
  maxInspects: numberSetting('MAX_INSPECTS', 3, 10),
  maxDuration: numberSetting('MAX_DURATION_SECONDS', 7200, 172800),
  inspectTimeout: numberSetting('INSPECT_TIMEOUT_MS', 60000, 300000),
  jobTimeout: numberSetting('JOB_TIMEOUT_MINUTES', 45, 1440) * 60000,
  ttl: numberSetting('FILE_TTL_HOURS', 720, 8760) * 3600000,
  accessPassword: process.env.ACCESS_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  trustProxy: process.env.TRUST_PROXY === '1',
};
export function validateStartup(configValue = config) {
  const publicBind = !['127.0.0.1', 'localhost', '::1'].includes(configValue.host);
  if ((publicBind || process.env.NODE_ENV === 'production') && (!configValue.accessPassword || configValue.accessPassword.length < 12 || configValue.sessionSecret.length < 32)) {
    throw new Error('Public binding requires ACCESS_PASSWORD (12+ chars) and SESSION_SECRET (32+ chars). See .env.example.');
  }
  if (configValue.accessPassword && configValue.sessionSecret.length < 32) throw new Error('SESSION_SECRET must be 32+ characters when ACCESS_PASSWORD is set.');
  if (configValue.maxTotalMB < configValue.maxDownloadMB) throw new Error('MAX_TOTAL_MB must be >= MAX_DOWNLOAD_MB.');
}
