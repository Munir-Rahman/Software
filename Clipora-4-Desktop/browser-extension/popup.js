const $ = id => document.getElementById(id);
const rates = [64, 96, 128, 160, 192, 256, 320];
let meta = null;
let paired = false;
function msg(text, isError = false) { $('message').textContent = text; $('message').classList.toggle('error', isError); }
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'Clipora extension could not complete this action.');
  return response.data;
}
function qualityOptions() {
  const type = $('format').value;
  $('quality').replaceChildren();
  const choices = type === 'mp3' ? rates.map(r => ({ value: r, label: `${r} kbps` }))
    : (meta?.kind === 'playlist' ? [2160, 1440, 1080, 720, 480, 360, 240].map(h => ({ value: h, label: `${h}p maximum` }))
    : (meta?.resolutions || []).filter(h => h >= 144).map(h => ({ value: h, label: `${h}p` })));
  for (const choice of choices) {
    const option = document.createElement('option'); option.value = String(choice.value); option.textContent = choice.label;
    $('quality').append(option);
  }
  const preferred = type === 'mp3' ? '192' : [...$('quality').options].find(o => Number(o.value) <= 1080)?.value;
  if (preferred) $('quality').value = preferred;
}
function showPlaylist(data) {
  $('playlistItems').replaceChildren(); $('playlist').classList.toggle('hide', data.kind !== 'playlist');
  if (data.kind !== 'playlist') return;
  for (const item of data.items) {
    const row = document.createElement('div'); row.className = 'small-item';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.value = item.url;
    const label = document.createElement('label'); label.textContent = item.title; label.title = item.title;
    row.append(checkbox, label); row.dataset.videoTitle = item.title; $('playlistItems').append(row);
  }
}
async function analyze() {
  const url = $('url').value.trim();
  if (!url) throw new Error('Paste a video, playlist, audio or image URL first.');
  msg('Checking available formats…'); $('analyze').disabled = true;
  try {
    meta = await send({ action: 'inspect', url });
    $('details').classList.remove('hide');
    $('metaTitle').textContent = meta.title || 'Media file';
    $('format').replaceChildren();
    const choices = meta.platform === 'direct' ? [['original', 'Original file']] : [['mp4', 'MP4 Video'], ['mp3', 'MP3 Audio']];
    for (const [value, text] of choices) { const option = document.createElement('option'); option.value = value; option.textContent = text; $('format').append(option); }
    $('formatOptions').classList.toggle('hide', meta.platform === 'direct');
    showPlaylist(meta);
    qualityOptions();
    msg(meta.kind === 'playlist' ? `${meta.items.length} videos found. Select and download.` : 'Ready to save. Choose format and quality.');
  } finally { $('analyze').disabled = false; }
}
function selectedPlaylistItems() {
  return [...$('playlistItems').children].filter(row => row.querySelector('input').checked).map(row => ({
    url: row.querySelector('input').value, title: row.dataset.videoTitle,
  }));
}
async function startDownload() {
  if (!meta) return;
  $('download').disabled = true;
  try {
    let result;
    if (meta.kind === 'playlist') {
      const items = selectedPlaylistItems();
      if (!items.length) throw new Error('Select at least one playlist video.');
      result = await send({ action: 'batch', payload: { items, type: $('format').value, height: Number($('quality').value),
        bitrate: Number($('quality').value), collection: meta.title } });
      msg(`${result.downloads.filter(x => !x.error).length} Chrome downloads started. Follow the progress below.`);
    } else {
      result = await send({ action: 'start', payload: { url: meta.sourceUrl || $('url').value,
        platform: meta.platform, type: meta.platform === 'direct' ? 'original' : $('format').value,
        height: Number($('quality').value) || 720, audioBitrate: Number($('quality').value) || 192,
        kind: meta.mediaKind, title: meta.title } });
      msg('Chrome download started. Press Ctrl+J to view it.');
    }
    void refresh();
  } finally { $('download').disabled = false; }
}
function humanSize(n) { return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`; }
async function refresh() {
  let state;
  try { state = await send({ action: 'status' }); } catch { return; }
  paired = state.paired;
  $('pairPanel').classList.toggle('hide', paired);
  $('recent').replaceChildren();
  if (!state.items.length) { const p = document.createElement('div'); p.className = 'hint'; p.textContent = 'Start a download to see progress here.'; $('recent').append(p); return; }
  for (const item of state.items) {
    const row = document.createElement('div'); row.className = 'download-item';
    const title = document.createElement('div'); title.className = 'download-head';
    const name = document.createElement('strong'); name.textContent = item.title || 'Clipora file';
    const label = document.createElement('span');
    const working = ['queued', 'downloading'].includes(item.jobStatus);
    let pct = working ? Math.round(item.jobProgress || 0) : item.total > 0 ? Math.round(item.received / item.total * 100) : null;
    label.textContent = item.state === 'complete' ? '✓ Saved' : item.state === 'interrupted' ? 'Interrupted' : working ? `${pct}% preparing` : pct === null ? item.state : `${pct}%`;
    title.append(name, label); row.append(title);
    const bar = document.createElement('div'); bar.className = 'bar'; const inner = document.createElement('b'); inner.style.width = `${pct || (item.state === 'complete' ? 100 : 0)}%`; bar.append(inner); row.append(bar);
    const extra = document.createElement('div'); extra.className = 'hint'; extra.style.marginTop = '5px';
    extra.textContent = item.error || (working ? [item.jobSpeed, item.jobEta && `ETA ${item.jobEta}`].filter(Boolean).join(' · ') || 'Local extraction in progress' : `${humanSize(item.received)}${item.total > 0 ? ' / ' + humanSize(item.total) : ''}`);
    row.append(extra); $('recent').append(row);
  }
}
$('pair').addEventListener('click', async () => {
  $('pair').disabled = true;
  try { await send({ action: 'pair', code: $('pairCode').value.trim() }); $('pairMsg').textContent = 'Connected.'; await refresh(); }
  catch (e) { $('pairMsg').textContent = e.message; $('pairMsg').classList.add('error'); }
  finally { $('pair').disabled = false; }
});
$('analyze').addEventListener('click', () => analyze().catch(e => msg(e.message, true)));
$('format').addEventListener('change', qualityOptions);
$('download').addEventListener('click', () => startDownload().catch(e => msg(e.message, true)));
$('toggleAll').addEventListener('click', () => {
  const inputs = [...$('playlistItems').querySelectorAll('input[type=checkbox]')];
  const next = inputs.some(i => !i.checked); inputs.forEach(i => { i.checked = next; });
});
$('scan').addEventListener('click', () => send({ action: 'scan' }).then(() => msg('Download buttons added to media on this page.')).catch(e => msg(e.message, true)));
$('chromeDownloads').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://downloads/' }));
$('url').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); analyze().catch(err => msg(err.message, true)); } });
(async () => {
  try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const fromContext = new URLSearchParams(location.search).get('url');
    if (fromContext && /^https?:\/\//i.test(fromContext)) {
      $('url').value = fromContext;
    } else if (tab?.url?.startsWith('https://')) {
      $('url').value = tab.url;
    }
  } catch { /* new-tab pages */ }
  await refresh();
  if (new URLSearchParams(location.search).has('url')) {
    analyze().catch(e => msg(e.message, true));
  }
  setInterval(refresh, 1300);
})();
