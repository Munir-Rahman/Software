// Only retry the documented no-cookie embedded YouTube client when the
// default extractor receives an explicit bot-verification challenge.
// This cannot make private, DRM-protected or non-embeddable content available.
export const youtubeArgs = profile => profile === 'embedded'
  ? ['--extractor-args', 'youtube:player_client=web_embedded']
  : [];

export function isBotVerification(error) {
  const details = String(error?.stderr || error?.message || '').toLowerCase();
  return /sign in to confirm.{0,100}(?:not a bot|you.re not a bot)/s.test(details);
}

export async function withYoutubeFallback({ platform, playlist = false, run }) {
  try { return { result: await run('default'), profile: 'default' }; }
  catch (error) {
    if (platform !== 'youtube' || playlist || !isBotVerification(error)) throw error;
    // One bounded retry only. Do not attempt cookies, proxies, or repeated
    // evasion if the provider declines the fallback client as well.
    return { result: await run('embedded'), profile: 'embedded' };
  }
}
