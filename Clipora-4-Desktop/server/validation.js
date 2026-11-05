// Public extractor sites are deliberately explicit. Arbitrary HTML crawling is not supported.
export const PLATFORMS = [
  { key: 'youtube', name: 'YouTube', domains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'] },
  { key: 'tiktok', name: 'TikTok', domains: ['tiktok.com'] },
  { key: 'instagram', name: 'Instagram', domains: ['instagram.com'] },
  { key: 'facebook', name: 'Facebook', domains: ['facebook.com', 'fb.watch', 'fb.com'] },
  { key: 'twitter', name: 'X / Twitter', domains: ['x.com', 'twitter.com'] },
  { key: 'vimeo', name: 'Vimeo', domains: ['vimeo.com'] },
  { key: 'reddit', name: 'Reddit', domains: ['reddit.com', 'redd.it'] },
  { key: 'pinterest', name: 'Pinterest', domains: ['pinterest.com', 'pin.it'] },
  { key: 'dailymotion', name: 'Dailymotion', domains: ['dailymotion.com', 'dai.ly'] },
  { key: 'twitch', name: 'Twitch', domains: ['twitch.tv', 'clips.twitch.tv'] },
  { key: 'linkedin', name: 'LinkedIn', domains: ['linkedin.com'] },
  { key: 'capcut', name: 'CapCut', domains: ['capcut.com'] },
  { key: 'coursera', name: 'Coursera', domains: ['coursera.org'] },
  { key: 'telegram', name: 'Telegram (public posts)', domains: ['t.me', 'telegram.me'] },
];
export const DIRECT_EXTENSIONS = Object.freeze({
  '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.m4v': 'video',
  '.mp3': 'audio', '.m4a': 'audio', '.ogg': 'audio', '.wav': 'audio',
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.gif': 'image',
});
export function userError(message, status = 400) { const e = new Error(message); e.status = status; return e; }
export function parseUrl(url) {
  if (typeof url !== 'string' || url.length > 2400 || /[\r\n]/.test(url)) throw userError('Enter a valid link (maximum 2400 characters).');
  let parsed;
  try { parsed = new URL(url.trim()); } catch { throw userError('Enter a complete HTTPS URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || (parsed.port && !['80', '443'].includes(parsed.port))) {
    throw userError('Only HTTP(S) links without credentials or custom ports are accepted.');
  }
  return parsed;
}
export function isYouTubePlaylist(parsed) {
  return (parsed.hostname.toLowerCase() === 'youtube.com' || parsed.hostname.toLowerCase().endsWith('.youtube.com'))
    && ((parsed.pathname === '/playlist' || parsed.pathname === '/watch') && Boolean(parsed.searchParams.get('list')));
}
export function findPlatform(url) {
  const parsed = parseUrl(url);
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const platform = PLATFORMS.find(p => p.domains.some(d => host === d || host.endsWith('.' + d)));
  if (platform) {
    if ((!parsed.pathname || parsed.pathname === '/') && !isYouTubePlaylist(parsed)) throw userError('Paste a link to a specific video, post, or playlist.');
    return { url: parsed.href, platform, playlist: platform.key === 'youtube' && isYouTubePlaylist(parsed) };
  }
  const ext = /\.[a-z0-9]+$/i.exec(parsed.pathname)?.[0]?.toLowerCase();
  const mediaKind = ext && DIRECT_EXTENSIONS[ext];
  if (!mediaKind) throw userError('Unsupported website. For other sites, paste a direct HTTPS image/video/audio file URL, or use the optional browser extension.');
  if (parsed.protocol !== 'https:') throw userError('Direct media files require HTTPS.');
  return { url: parsed.href, platform: { key: 'direct', name: 'Direct media' }, mediaKind, ext };
}
export function youtubeEntryUrl(entry) {
  const id = String(entry?.id || '').trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}
export function playlistForClient(meta, platform, sourceUrl, limit = 50) {
  if (platform.key !== 'youtube' || !Array.isArray(meta?.entries)) throw userError('Could not read a YouTube playlist.', 422);
  const items = meta.entries.slice(0, limit).flatMap((entry, index) => {
    const url = youtubeEntryUrl(entry);
    if (!url) return [];
    return [{ id: entry.id, url, title: String(entry.title || `Video ${index + 1}`).slice(0, 200),
      duration: Number.isFinite(entry.duration) ? Math.round(entry.duration) : null,
      thumbnail: typeof entry.thumbnail === 'string' && entry.thumbnail.startsWith('https://') ? entry.thumbnail : `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg` }];
  });
  if (!items.length) throw userError('No public downloadable playlist videos were found.', 422);
  return { kind: 'playlist', platform: platform.key, title: String(meta.title || 'YouTube playlist').slice(0, 200),
    sourceUrl, totalReported: Number.isFinite(meta.playlist_count) ? meta.playlist_count : null,
    truncated: Number.isFinite(meta.playlist_count) ? meta.playlist_count > items.length : meta.entries.length >= limit, items };
}
