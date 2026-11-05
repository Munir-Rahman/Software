/* User-triggered overlay controls. Never auto-download a thumbnail. */
(() => {
  if (globalThis.__cliporaMediaInstalled) return;
  globalThis.__cliporaMediaInstalled = true;
  const resolver = globalThis.CliporaMediaTarget?.resolveMediaTarget;
  if (typeof resolver !== 'function') return;
  const buttons = new WeakSet();
  const style = document.createElement('style');
  style.textContent = `.clipora-badge-btn{all:initial!important;box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;position:absolute!important;top:7px!important;right:7px!important;z-index:2147483000!important;background:#13a980!important;color:white!important;border:1px solid #b3f4df!important;border-radius:9px!important;box-shadow:0 3px 15px #0008!important;padding:7px 11px!important;font:700 12px system-ui,sans-serif!important;cursor:pointer!important}.clipora-badge-btn:hover{background:#087657!important}`;
  document.documentElement.append(style);
  const ask = message => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      const error = chrome.runtime.lastError;
      if (error) return reject(new Error(error.message));
      if (!response?.ok) return reject(new Error(response?.error || 'Clipora could not process this link.'));
      resolve(response.data);
    });
  });
  function openChooser(target) {
    document.getElementById('__clipora_chooser')?.remove();
    const mount = document.createElement('div');
    mount.id = '__clipora_chooser';
    mount.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;background:#030e16b9!important;padding:12px!important;';
    const shadow = mount.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>*{box-sizing:border-box} .panel{color:#ecfff8;background:#0c2630;border:1px solid #397366;border-radius:18px;width:min(430px,100%);max-height:90vh;overflow:auto;box-shadow:0 20px 90px #000c;font:13px system-ui;padding:22px}h2{font-size:22px;margin:0 0 7px}.sub{color:#a7c9c9;font-size:12px;line-height:1.5;margin:0 0 12px}.link{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#74ecc4;font-size:11px;margin:0 0 15px}select,button{font:inherit}select{width:100%;border:1px solid #527871;background:#0a1b23;color:#fff;border-radius:9px;padding:10px;margin:5px 0 14px}label{display:block;color:#bfe5dc;font-size:11px;font-weight:700;margin-top:8px}button{cursor:pointer;border:0;border-radius:9px;padding:11px 13px;font-weight:750}.primary{width:100%;background:#4de4ac;color:#082b1e;margin-top:12px}.close{background:#25434d;color:#eafff5}.head{display:flex;align-items:center;justify-content:space-between;gap:10px}#msg{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;color:#f7c7a1;min-height:20px}#title{color:#f2fff9;font-size:13px;font-weight:700;line-height:1.5}.items{max-height:170px;overflow:auto}.item{display:flex;gap:8px;align-items:center;font-size:11px;padding:5px 0}.item input{accent-color:#54d9ad}#form[hidden],#formatWrap[hidden],#listWrap[hidden]{display:none}</style><div class="panel" role="dialog" aria-modal="true" aria-label="Clipora media download"><div class="head"><h2>clipora<span style="color:#63edb9">.</span></h2><button class="close" id="close" aria-label="Close download dialog">✕</button></div><p class="sub">Choose your format and quality before downloading to Chrome.</p><span class="link" id="link"></span><p id="msg">Checking available formats…</p><div id="form" hidden><p id="title"></p><div id="formatWrap"><label for="format">Download as</label><select id="format"><option value="mp4">MP4 · Video</option><option value="mp3">MP3 · Audio</option></select><label for="quality">Quality</label><select id="quality"></select></div><div id="listWrap" hidden><p class="sub" id="listTitle"></p><div class="items" id="items"></div></div><button class="primary" id="save">Download to Chrome ↓</button></div><p class="sub" style="margin:12px 0 0">Social platforms require the local Clipora engine and one-time extension pairing. Use only media you have permission to save.</p></div>`;
    document.documentElement.append(mount);
    const $ = id => shadow.getElementById(id);
    $('link').textContent = target.url;
    $('close').addEventListener('click', () => mount.remove());
    mount.addEventListener('click', e => { if (e.target === mount) mount.remove(); });
    const onKey = e => { if (e.key === 'Escape') { mount.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    let info = null;
    const rates = [64, 96, 128, 160, 192, 256, 320];
    const updateQuality = () => {
      const audio = $('format').value === 'mp3';
      const options = audio ? rates : info?.kind === 'playlist' ? [2160,1440,1080,720,480,360,240] : (info?.resolutions || []);
      $('quality').replaceChildren();
      for (const n of options.filter(n => Number.isInteger(n) && n > 0)) {
        const o = document.createElement('option');o.value = String(n);o.textContent = audio ? `${n} kbps` : `${n}p${info?.kind === 'playlist' ? ' maximum' : ''}`;$('quality').append(o);
      }
      const preferred = audio ? 192 : options.find(n => n <= 1080) || options[0];
      if (preferred) $('quality').value = String(preferred);
    };
    $('format').addEventListener('change', updateQuality);
    ask({ action: 'inspect', url: target.url }).then(data => {
      info = data;
      $('title').textContent = data.title || 'Media file';
      if (data.platform === 'direct') $('formatWrap').hidden = true;
      if (data.kind === 'playlist') {
        $('listWrap').hidden = false;
        $('listTitle').textContent = `${data.items.length} videos available. Choose which to save.`;
        for (const item of data.items) {
          const label = document.createElement('label'); label.className = 'item';
          const box = document.createElement('input');box.type='checkbox';box.checked=true;box.value=item.url;
          const caption = document.createElement('span'); caption.textContent=item.title;
          label.append(box,caption);$('items').append(label);
        }
      }
      updateQuality();
      $('msg').textContent = data.platform === 'direct' ? 'Original media file ready to save.' : 'Select MP4 video or MP3 audio and the desired quality.';
      $('form').hidden = false;
    }).catch(e => {
      $('msg').textContent = `${e.message}\nStart Clipora on Windows and pair the extension in its toolbar popup.`;
    });
    $('save').addEventListener('click', async () => {
      if (!info) return;
      $('save').disabled = true;
      $('msg').textContent = 'Starting download…';
      try {
        const quality = Number($('quality').value);
        let result;
        if (info.kind === 'playlist') {
          const selected = [...$('items').querySelectorAll('input:checked')].map(el => ({ url: el.value, title: el.parentElement.querySelector('span').textContent }));
          if (!selected.length) throw new Error('Select at least one video.');
          result = await ask({ action: 'batch', payload: { items: selected, type: $('format').value, height: quality || 720, bitrate: quality || 192, collection: info.title } });
          $('msg').textContent = `${result.downloads.filter(x => !x.error).length} downloads started. Follow progress in Chrome Downloads (Ctrl+J).`;
        } else {
          result = await ask({ action: 'start', payload: { url: info.sourceUrl || target.url, platform: info.platform, type: info.platform === 'direct' ? 'original' : $('format').value,
            height: $('format').value === 'mp3' ? 720 : quality, audioBitrate: $('format').value === 'mp3' ? quality : 192,
            kind: info.mediaKind, title: info.title } });
          $('msg').textContent = 'Started! See Chrome Downloads (Ctrl+J) for progress and the saved file.';
        }
      } catch (e) { $('msg').textContent = e.message; }
      finally { $('save').disabled = false; }
    });
  }
  function decorate() {
    for (const el of document.querySelectorAll('img,video,audio')) {
      if (buttons.has(el) || !el.isConnected) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 150 || rect.height < 100) continue;
      if (el.tagName === 'IMG' && el.naturalWidth && el.naturalWidth < 150) continue;
      const target = resolver(el, location);
      if (!target) continue; // YouTube decorative imagery is not a downloadable video.
      const parent = el.parentElement;
      if (!parent || parent.tagName === 'BUTTON') continue;
      buttons.add(el);
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      const btn = document.createElement('button');btn.type='button';btn.className='clipora-badge-btn';
      btn.textContent = target.kind === 'image' ? '↓ Clipora image' : '↓ Clipora video';
      btn.title = target.kind === 'image' ? 'Save this image' : 'Choose MP4 / MP3 and video quality';
      btn.addEventListener('click', event => {event.stopImmediatePropagation();event.stopPropagation();event.preventDefault();openChooser(target);}, true);
      parent.append(btn);
    }
  }
  decorate();
  let timer;
  new MutationObserver(() => { if (timer) return; timer = setTimeout(() => {timer=null;decorate();}, 700); }).observe(document.documentElement, { childList:true,subtree:true });
})();
