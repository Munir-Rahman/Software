/* Determine what a media tile actually represents. A YouTube thumbnail is a link
   to a video, NOT the WebP artwork; never offer that artwork as the video. */
(() => {
  function videoLink(value, base) {
    if (!value) return null;
    try {
      const url = new URL(value, base);
      const host = url.hostname.toLowerCase();
      const youtube = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
      if (!youtube || url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      if (host === 'youtu.be' && /^\/[\w-]{11}$/.test(url.pathname)) return url.href;
      if (url.pathname === '/watch' && /^[\w-]{11}$/.test(url.searchParams.get('v') || '')) {
        url.searchParams.delete('list'); url.searchParams.delete('index'); url.searchParams.delete('start_radio');
        return url.href;
      }
      if (/^\/(shorts|live)\/[\w-]{11}(?:\/|$)/.test(url.pathname)) return url.href;
      return null;
    } catch { return null; }
  }
  function findVideoLink(element, origin) {
    const anchor = element.closest?.('a[href]');
    const direct = videoLink(anchor?.href || anchor?.getAttribute?.('href'), origin);
    if (direct) return direct;
    const container = element.closest?.('ytd-thumbnail, ytd-rich-grid-media, ytd-compact-video-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, ytd-rich-item-renderer, yt-lockup-view-model, .yt-lockup-view-model, ytm-video-with-context-renderer');
    if (container) {
      for (const a of container.querySelectorAll?.('a[href*="/watch"],a[href*="/shorts/"],a[href*="/live/"],a[href*="youtu.be/"]') || []) {
        const result = videoLink(a.href || a.getAttribute('href'), origin);
        if (result) return result;
      }
    }
    return null;
  }
  function resolveMediaTarget(element, locationInfo) {
    const loc = locationInfo || globalThis.location;
    const origin = loc.origin || String(loc.href);
    const host = new URL(loc.href).hostname.toLowerCase();
    const onYouTube = host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
    const tag = element.tagName.toUpperCase();
    if (onYouTube) {
      if (tag === 'IMG') {
        const watchUrl = findVideoLink(element, origin);
        return watchUrl ? { url: watchUrl, kind: 'page' } : null;
      }
      if (tag === 'VIDEO') {
        const url = videoLink(loc.href, origin);
        return url ? { url, kind: 'page' } : null;
      }
      return null;
    }
    if (tag === 'IMG') {
      const anchor = element.closest?.('a[href]');
      const href = anchor?.href || anchor?.getAttribute?.('href') || '';
      try {
        const link = new URL(href, origin);
        // Other social-media thumbnails that link to posts should analyze the post.
        if (/\/(?:watch|video|videos|reel|reels|shorts|posts|p)\//i.test(link.pathname) && /^https?:$/.test(link.protocol)) {
          return { url: link.href, kind: 'page' };
        }
      } catch { /* Not a useful link */ }
    }
    let raw = element.currentSrc || element.src || element.querySelector?.('source')?.src || '';
    try {
      const u = new URL(raw, origin);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        return { url: u.href, kind: tag === 'IMG' ? 'image' : tag === 'AUDIO' ? 'audio' : 'video' };
      }
    } catch { /* blob and invalid links must not be saved as MP4 */ }
    return tag === 'IMG' ? null : { url: loc.href, kind: 'page' };
  }
  globalThis.CliporaMediaTarget = { resolveMediaTarget, findVideoLink, videoLink };
})();
