import { userError } from '../validation.js';
export function metadataForClient(meta, platform, url, maxDuration) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw userError('Invalid video metadata.', 502);
  if (meta.is_live || ['is_live', 'is_upcoming', 'post_live'].includes(meta.live_status)) throw userError('Live video is not supported.', 422);
  if (Number.isFinite(meta.duration) && meta.duration > maxDuration) throw userError('The video exceeds the configured duration limit.', 413);
  const formats = Array.isArray(meta.formats) ? meta.formats : [];
  const resolutions = [...new Set(formats.filter(f => f && f.vcodec && f.vcodec !== 'none' && Number.isFinite(f.height) && f.height >= 144 && f.height <= 8640).map(f => Math.round(f.height)))];
  if (!resolutions.length && Number.isFinite(meta.height) && meta.height >= 144 && meta.height <= 8640) resolutions.push(Math.round(meta.height));
  resolutions.sort((a,b) => b-a);
  return {
    platform: platform.key,
    title: String(meta.title || 'Untitled video').slice(0, 200),
    creator: String(meta.uploader || meta.channel || meta.creator || platform.name).slice(0, 120),
    thumbnail: thumbnail(meta.thumbnail),
    duration: Number.isFinite(meta.duration) ? Math.round(meta.duration) : null,
    viewCount: Number.isFinite(meta.view_count) ? meta.view_count : null,
    resolutions,
    sourceUrl: url,
    sourceFormat: meta.ext || null,
  };
}
function thumbnail(value) {
  if (typeof value !== 'string') return null;
  try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
}
export function friendlyError(error, maxDownloadMB) {
  if (error.code === 'ENOENT') return 'yt-dlp is missing. Run the Windows setup script or npm run doctor.';
  if (error.code === 'TIMEOUT') return 'The provider took too long or the job exceeded its time limit.';
  if (error.code === 'OUTPUT-LIMIT') return 'The extractor response was unexpectedly large.';
  if (error.code === 'CANCELLED') return 'Download was cancelled.';
  const e = (error.stderr || '').toLowerCase();
  if (e.includes('sign in') || e.includes('login') || e.includes('private video') || e.includes('members-only')) return 'This video is private or requires an account.';
  if (e.includes('unsupported url')) return 'The extractor does not currently support this link.';
  if (e.includes('requested format is not available')) return 'The chosen resolution could not be downloaded.';
  if (e.includes('ffmpeg') || e.includes('ffprobe')) return 'FFmpeg is missing or unable to process the source. Run npm run doctor.';
  if (e.includes('max-filesize') || e.includes('larger than max')) return `File exceeds the configured ${maxDownloadMB} MB limit.`;
  if (e.includes('video unavailable')) return 'The video is unavailable or restricted.';
  return 'The video cannot currently be processed. Update yt-dlp or try another public URL.';
}
