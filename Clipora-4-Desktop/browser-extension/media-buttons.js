(() => {
  if (window.__cliporaMediaInstalled) return;
  window.__cliporaMediaInstalled = true;
  const style = document.createElement('style');
  style.textContent = `.clipora-badge-btn{all:initial!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;position:absolute!important;top:7px!important;right:7px!important;z-index:2147483000!important;background:#13b889!important;color:white!important;border:1px solid #b3f4df!important;border-radius:10px!important;box-shadow:0 3px 15px #0008!important;padding:7px 11px!important;font:700 12px system-ui,sans-serif!important;cursor:pointer!important}.clipora-badge-btn:hover{background:#098b69!important}`;
  document.documentElement.append(style);
  const decorate = () => {
    for (const el of document.querySelectorAll('img,video,audio')) {
      if (el.dataset.cliporaSeen) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 150 || rect.height < 100) continue;
      if (el.tagName === 'IMG' && el.naturalWidth && el.naturalWidth < 150) continue;
      const parent = el.parentElement;
      if (!parent || parent.tagName === 'BUTTON') continue;
      el.dataset.cliporaSeen = 'true';
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clipora-badge-btn';
      btn.textContent = '↓ Clipora';
      btn.title = 'Download without opening Clipora website';
      btn.addEventListener('click', event => {
        event.stopImmediatePropagation(); event.stopPropagation(); event.preventDefault();
        const kind = el.tagName.toLowerCase() === 'img' ? 'image' : el.tagName.toLowerCase() === 'audio' ? 'audio' : 'video';
        const directUrl = el.currentSrc || el.src || el.querySelector('source')?.src;
        const url = directUrl?.startsWith('https://') ? directUrl : location.href;
        btn.textContent = 'Starting…'; btn.disabled = true;
        chrome.runtime.sendMessage({ action: 'quick', url, kind: url === location.href ? 'page' : kind }, response => {
          if (chrome.runtime.lastError || !response?.ok) {
            btn.textContent = 'Try Clipora popup'; btn.title = response?.error || chrome.runtime.lastError?.message || 'Download failed';
          } else { btn.textContent = '✓ In Downloads'; btn.title = 'Check Chrome Downloads (Ctrl+J).'; }
          setTimeout(() => { btn.disabled = false; btn.textContent = '↓ Clipora'; }, 4500);
        });
      }, true);
      parent.append(btn);
    }
  };
  decorate();
  let throttle = 0;
  new MutationObserver(() => {
    if (throttle) return;
    throttle = setTimeout(() => { throttle = 0; decorate(); }, 750);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
