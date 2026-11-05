/* Deliberately restricted to Clipora's published site. This does not expose the
   desktop pairing token to the webpage. Every request is checked by the worker. */
(() => {
  if (location.origin !== 'https://clipora-4-desktop.vercel.app') return;
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'clipora-page-request') return;
    const { id, action, payload } = event.data;
    if (typeof id !== 'string' || id.length > 100 || !['inspect','start','batch','status','cancel'].includes(action)) return;
    const request = action === 'inspect' ? { action, url: payload?.url }
      : action === 'status' ? { action }
      : action === 'cancel' ? { action, chromeDownloadId: payload?.chromeDownloadId, jobId: payload?.jobId }
      : { action, payload };
    chrome.runtime.sendMessage(request, reply => {
      const failure = chrome.runtime.lastError?.message;
      window.postMessage({ channel:'clipora-extension-reply', id, ok: !failure && !!reply?.ok,
        data: reply?.data, error: failure || reply?.error || 'Extension request failed.' }, location.origin);
    });
  });
  window.postMessage({ channel: 'clipora-extension-ready' }, location.origin);
})();
