import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, BadgeCheck, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clipboard, Clock3, CloudDownload,
  Download, ExternalLink, Film, Globe2, Headphones, Heart,
  Info, Link2, LoaderCircle, LockKeyhole, Menu, MonitorDown,
  MousePointerClick, Music2, Play, PlayCircle, RotateCcw,
  Search, ShieldCheck, Sparkles, WandSparkles, X as CloseIcon,
  Zap, FolderOpen, Image as ImageIcon, Layers3, ListVideo, FolderDown, ExternalLink as ExternalLinkIcon, CheckSquare, Square, RefreshCcw, FileVideo, LayoutGrid, PanelTopOpen, BookOpen, Send,
} from 'lucide-react';

const PUBLIC_CONTACT_EMAIL = 'munirrahmanrahmani0@gmail.com';
const PUBLIC_REPO = 'https://github.com/Munir-Rahman/Software/tree/main/Clipora-4-Desktop';
const EXTENSION_DOWNLOAD_URL = '/downloads/clipora-chrome-edge-extension-v4.zip';
const DESKTOP_SOURCE_URL = '/downloads/clipora-desktop-windows-source-v4.zip';
const MOBILE_SOURCE_URL = '/downloads/clipora-mobile-android-ios-source.zip';
const hostedPreview = import.meta.env.VITE_HOSTED_PREVIEW === '1';

const PAGE_BRIDGE_TIMEOUT = 8500;
function extensionRequest(action, payload = {}) {
  return new Promise((resolve, reject) => {
    // This site bridge exists only when the user's Clipora Chrome/Edge extension
    // is installed. The paired local engine remains responsible for extraction.
    const id = `clipora-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let finished = false;
    const finish = (error, data) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (error) reject(error); else resolve(data);
    };
    const onMessage = event => {
      if (event.source !== window || event.origin !== window.location.origin ||
          event.data?.channel !== 'clipora-extension-reply' || event.data.id !== id) return;
      finish(event.data.ok ? null : new Error(event.data.error || 'Clipora extension failed.'), event.data.data);
    };
    const timer = setTimeout(() => finish(new Error('Clipora extension not connected. Install/reload the Chrome/Edge extension, start Clipora on Windows, and pair it with the code shown in your terminal.')), PAGE_BRIDGE_TIMEOUT);
    window.addEventListener('message', onMessage);
    window.postMessage({ channel: 'clipora-page-request', id, action, payload }, window.location.origin);
  });
}


const platforms = [
  { key: 'auto', label: 'Auto detect', short: 'Auto', domain: '', tone: '#60e7bd' },
  { key: 'youtube', label: 'YouTube', short: 'YouTube', domain: 'youtube.com', tone: '#ff353b' },
  { key: 'tiktok', label: 'TikTok', short: 'TikTok', domain: 'tiktok.com', tone: '#64eee5' },
  { key: 'instagram', label: 'Instagram', short: 'Instagram', domain: 'instagram.com', tone: '#fd5892' },
  { key: 'facebook', label: 'Facebook', short: 'Facebook', domain: 'facebook.com', tone: '#448dff' },
  { key: 'twitter', label: 'X / Twitter', short: 'X / Twitter', domain: 'x.com', tone: '#ffffff' },
  { key: 'vimeo', label: 'Vimeo', short: 'Vimeo', domain: 'vimeo.com', tone: '#58caff' },
  { key: 'reddit', label: 'Reddit', short: 'Reddit', domain: 'reddit.com', tone: '#ff643c' },
  { key: 'pinterest', label: 'Pinterest', short: 'Pinterest', domain: 'pinterest.com', tone: '#f04e55' },
  { key: 'dailymotion', label: 'Dailymotion', short: 'Dailymotion', domain: 'dailymotion.com', tone: '#a3beff' },
  { key: 'twitch', label: 'Twitch', short: 'Twitch', domain: 'twitch.tv', tone: '#ac7cff' },
  { key: 'linkedin', label: 'LinkedIn', short: 'LinkedIn', domain: 'linkedin.com', tone: '#2787ca' },
  { key: 'capcut', label: 'CapCut', short: 'CapCut', domain: 'capcut.com', tone: '#3bd5bb' },
  { key: 'coursera', label: 'Coursera', short: 'Coursera', domain: 'coursera.org', tone: '#0056d2' },
  { key: 'telegram', label: 'Telegram', short: 'Telegram', domain: 't.me', tone: '#229ed9' },
  { key: 'direct', label: 'Direct files', short: 'Media URL', domain: '', tone: '#80c2f5' },
];

function PlatformIcon({ name, size = 20 }) {
  if (name === 'auto') return <Sparkles size={size} strokeWidth={2.1} />;
  if (name === 'youtube') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.5 7.1a3 3 0 0 0-2.12-2.12C18.51 4.5 12 4.5 12 4.5s-6.51 0-8.38.48A3 3 0 0 0 1.5 7.1 31 31 0 0 0 1 12a31 31 0 0 0 .5 4.9 3 3 0 0 0 2.12 2.12c1.87.48 8.38.48 8.38.48s6.51 0 8.38-.48a3 3 0 0 0 2.12-2.12A31 31 0 0 0 23 12a31 31 0 0 0-.5-4.9ZM9.75 15.43V8.57L15.73 12l-5.98 3.43Z"/></svg>
  );
  if (name === 'tiktok') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.2 2H13v13.1a3.2 3.2 0 1 1-2.8-3.17V8.6a6.55 6.55 0 1 0 6.05 6.55V8.45A8.1 8.1 0 0 0 21 10V6.8c-2.49 0-4.44-1.78-4.8-4.8Z"/></svg>
  );
  if (name === 'instagram') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.25"/><circle cx="17.7" cy="6.5" r="1.15" fill="currentColor" stroke="none"/></svg>
  );
  if (name === 'facebook') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.7 21.5v-8.3h2.8l.43-3.23h-3.23V7.91c0-.94.26-1.58 1.61-1.58h1.72V3.44a22 22 0 0 0-2.5-.13c-2.48 0-4.2 1.5-4.2 4.27v2.39H7.5v3.23h2.83v8.3h3.37Z"/></svg>
  );
  if (name === 'twitter') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.1 8.1L23.3 22h-6.6l-5.2-7.2L5.2 22H2.1l7.6-8.7L1.7 2h6.8l4.7 6.6L18.9 2Zm-1.1 18h1.8L7.4 3.9H5.5L17.8 20Z"/></svg>
  );
  if (name === 'vimeo') return <PlayCircle size={size} />;
  if (name === 'reddit') return <Globe2 size={size} />;
  if (name === 'pinterest') return <span className="pinterest-letter" aria-hidden="true">P</span>;
  if (name === 'dailymotion') return <Film size={size} />;
  if (name === 'twitch') return <MonitorDown size={size} />;
  if (name === 'coursera') return <BookOpen size={size} />;
  if (name === 'telegram') return <Send size={size} />;
  if (name === 'capcut') return <Film size={size} />;
  if (name === 'linkedin') return <span className="linkedin-letter">in</span>;
  if (name === 'direct') return <FolderDown size={size} />;
  return <Globe2 size={size} />;
}

function platformByKey(key) {
  return platforms.find(p => p.key === key) || platforms[0];
}
function guessPlatform(text) {
  try {
    const host = new URL(text).hostname.toLowerCase();
    return platforms.find(p => p.domain && (host === p.domain || host.endsWith('.' + p.domain)
      || (p.key === 'youtube' && host === 'youtu.be') || (p.key === 'facebook' && host === 'fb.watch')
      || (p.key === 'twitter' && host === 'twitter.com') || (p.key === 'reddit' && host === 'redd.it')
      || (p.key === 'pinterest' && host === 'pin.it') || (p.key === 'dailymotion' && host === 'dai.ly') || (p.key === 'telegram' && host === 'telegram.me')))?.key || (/\.(mp4|m4v|mov|webm|mp3|m4a|ogg|wav|jpg|jpeg|png|webp|gif)$/i.test(new URL(text).pathname) ? 'direct' : 'auto');
  } catch { return 'auto'; }
}
function fmtDuration(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Unknown size';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
function fmtCount(count) {
  if (!Number.isFinite(count)) return null;
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count);
}
async function apiRequest(endpoint, options) {
  let response;
  try {
    response = await fetch(`/api${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Clipora-Request': '1', ...options?.headers },
    });
  } catch {
    throw new Error('Cannot connect to the downloader server. Check that the backend is running.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an invalid response.'); }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function Logo({ inverted = false }) {
  return (
    <a href="#top" className={`logo${inverted ? ' logo-inverted' : ''}`} aria-label="Clipora home">
      <span className="logo-symbol"><Play fill="currentColor" size={18} strokeWidth={2.5} /></span>
      <span>clipora<span className="logo-dot">.</span></span>
    </a>
  );
}

function App() {
  const [platform, setPlatform] = useState('auto');
  const [url, setUrl] = useState('');
  const [video, setVideo] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [selectedHeight, setSelectedHeight] = useState(null);
  const [type, setType] = useState('mp4');
  const [audioBitrate, setAudioBitrate] = useState(192);
  const [collection, setCollection] = useState('');
  const [playlistSelected, setPlaylistSelected] = useState([]);
  const [playlistHeight, setPlaylistHeight] = useState(1080);
  const [playlistType, setPlaylistType] = useState('mp4');
  const [batchBusy, setBatchBusy] = useState(false);
  const [library, setLibrary] = useState([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryStatus, setLibraryStatus] = useState('all');
  const [browserAddress, setBrowserAddress] = useState('https://www.google.com');
  const [googleQuery, setGoogleQuery] = useState('');
  const [browserPage, setBrowserPage] = useState('');
  const [statusItems, setStatusItems] = useState([]);
  const [statusNotice, setStatusNotice] = useState('');

  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('cliporaAutoSave') !== '0');
  const nativeSavedJobs = useRef(new Set());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [auth, setAuth] = useState({ loading: !hostedPreview, required: false, authenticated: hostedPreview });
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [diagnostics, setDiagnostics] = useState(null);
  const [extensionConnected, setExtensionConnected] = useState(false);
  useEffect(() => {
    if (!hostedPreview) return;
    const onReady = event => {
      if (event.source === window && event.origin === window.location.origin && event.data?.channel === 'clipora-extension-ready') setExtensionConnected(true);
    };
    window.addEventListener('message', onReady);
    extensionRequest('status').then(() => setExtensionConnected(true)).catch(() => {});
    return () => window.removeEventListener('message', onReady);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incoming = params.get('url');
    if (incoming && /^https?:\/\//i.test(incoming)) {
      setUrl(incoming.slice(0, 2400)); setPlatform(guessPlatform(incoming));
      window.history.replaceState({}, '', window.location.pathname + '#downloader');
    }
  }, []);
  useEffect(() => {
    if (hostedPreview || auth.loading || !auth.authenticated) return;
    let alive = true;
    const refresh = () => apiRequest('/jobs?limit=200').then(data => { if (alive) setLibrary(data.jobs || []); }).catch(() => {});
    refresh(); const timer = setInterval(refresh, 2500);
    return () => { alive = false; clearInterval(timer); };
  }, [auth.loading, auth.authenticated]);
  const openBrowser = e => {
    e.preventDefault();
    try {
      const parsed = new URL(browserAddress);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname.includes('.') || parsed.hostname.endsWith('.localhost')) throw Error();
      setBrowserPage(parsed.href);
    } catch { setStatusNotice('Enter a valid public HTTPS website URL.'); }
  };
  const useBrowserUrl = () => { if (!browserPage) return; updateUrl(browserPage); setPlatform(guessPlatform(browserPage)); window.location.hash = '#downloader'; };
  const openStatuses = async () => {
    if (typeof window.showDirectoryPicker !== 'function') { setStatusNotice('Folder access requires Chrome/Edge on localhost or HTTPS.'); return; }
    try {
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      const found = [];
      for await (const file of dir.values()) {
        if (file.kind !== 'file' || !/\.(png|jpe?g|webp|gif|mp4|webm)$/i.test(file.name)) continue;
        const blob = await file.getFile();
        found.push({ name: file.name, blob, href: URL.createObjectURL(blob), media: /^video\//.test(blob.type) ? 'video' : 'image' });
        if (found.length >= 250) break;
      }
      setStatusItems(previous => { previous.forEach(item => URL.revokeObjectURL(item.href)); return found; });
      setStatusNotice(`Imported ${found.length} local media files from ${dir.name}. Only files you selected are read.`);
    } catch(e) { if (e.name !== 'AbortError') setStatusNotice('Could not read this folder: ' + e.message); }
  };
  const startBatch = async () => {
    if (!video?.items?.length || !playlistSelected.length) return;
    setBatchBusy(true); setError('');
    try {
      const items = video.items.filter(item => playlistSelected.includes(item.id)).map(item => ({
        url: item.url, platform: 'youtube', type: playlistType, height: playlistHeight,
        audioBitrate, title: item.title, collection: video.title,
      }));
      if (hostedPreview) {
        const response = await extensionRequest('batch', { items: items.map(item => ({url: item.url, title: item.title})),
          type: playlistType, height: playlistHeight, bitrate: audioBitrate, collection: video.title });
        const count = response.downloads.filter(x => !x.error).length;
        setNotice(`${count} download(s) added to Chrome Downloads. Press Ctrl+J for progress.`);
      } else {
        const response = await apiRequest('/download/batch', { method: 'POST', body: JSON.stringify({ items }) });
        setNotice(`${response.jobs.length} videos queued. Open Download library to see progress.`);
        window.location.hash = '#library';
      }
    } catch(e) { setError(e.message); } finally { setBatchBusy(false); }
  };
  const requestSeq = useRef(0);
  const formRef = useRef(null);

  useEffect(() => {
    if (hostedPreview) return;
    apiRequest('/auth').then(value => setAuth({ loading: false, ...value }))
      .catch(err => { setAuth(a => ({ ...a, loading: false, error: err.message })); });
  }, []);

  useEffect(() => {
    if (hostedPreview || auth.loading || !auth.authenticated) return;
    apiRequest('/diagnostics').then(setDiagnostics).catch(() => {});
  }, [auth.authenticated, auth.loading]);

  const logIn = async event => {
    event.preventDefault();
    setLoggingIn(true); setAuthError('');
    try {
      await apiRequest('/login', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword(''); setAuth({ loading: false, required: true, authenticated: true });
    } catch (e) { setAuthError(e.message); }
    finally { setLoggingIn(false); }
  };
  const logOut = async () => {
    await apiRequest('/logout', { method: 'POST' });
    setAuth({ loading: false, required: true, authenticated: false });
    setVideo(null); setJob(null); setJobId(null); setDiagnostics(null);
  };
  const cancelDownload = async () => {
    if (!jobId) return;
    try {
      if (hostedPreview) {
        const state = await extensionRequest('status');
        const item = state.items.find(entry => entry.id === jobId);
        if (!item) throw new Error('Download not found in Chrome.');
        await extensionRequest('cancel', { chromeDownloadId: item.chromeDownloadId, jobId });
        setJob(j => ({ ...j, status: 'cancelled' }));
      } else {
        const response = await apiRequest(`/jobs/${jobId}/cancel`, { method: 'POST' });
        setJob(response);
      }
    } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    let interval;
    const poll = async () => {
      try {
        let next;
        if (hostedPreview) {
          const state = await extensionRequest('status');
          const item = state.items.find(entry => entry.id === jobId);
          if (!item) return;
          next = { id: jobId, status: item.state === 'complete' ? 'ready'
            : item.state === 'interrupted' ? 'error' : item.jobStatus || 'downloading',
            progress: Number(item.jobProgress ?? (item.total > 0 ? item.received / item.total * 100 : 0)),
            sizeBytes: item.total > 0 ? item.total : null,
            speed: item.jobSpeed, eta: item.jobEta, error: item.error || null };
        } else {
          next = await apiRequest(`/jobs/${jobId}`);
        }
        if (cancelled) return;
        setJob(next);
        if (['ready', 'error', 'cancelled'].includes(next.status)) {
          clearInterval(interval);
          if (next.error) setError(next.error);
        }
      } catch (e) {
        if (!cancelled) {
          clearInterval(interval);
          setError(e.message);
        }
      }
    };
    poll();
    interval = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(interval); };
  }, [jobId]);

  // Saving through an ordinary same-origin attachment link makes Chrome own the file,
  // so it appears in chrome://downloads rather than being retained in JS memory.
  useEffect(() => {
    if (hostedPreview || !autoSave || job?.status !== 'ready' || !job.downloadUrl || nativeSavedJobs.current.has(job.id)) return;
    nativeSavedJobs.current.add(job.id);
    const link = document.createElement('a');
    link.href = job.downloadUrl;
    link.download = 'clipora';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setNotice('Your file has been sent to Chrome Downloads. If Chrome blocks automatic downloads, click Save to device.');
  }, [job?.id, job?.status, job?.downloadUrl, autoSave]);

  const clearResults = () => {
    requestSeq.current += 1;
    setVideo(null);
    setSelectedHeight(null);
    setType('mp4');
    setPlaylistSelected([]);
    setJobId(null);
    setJob(null);
    setError('');
    setNotice('');
    setInspecting(false);
  };
  const updateUrl = value => {
    setUrl(value);
    if (video || job) clearResults();
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) return setNotice('Your clipboard is empty.');
      updateUrl(text.trim());
      setPlatform(guessPlatform(text.trim()));
      setNotice('Link pasted from clipboard.');
    } catch {
      setNotice('Clipboard access is unavailable here. Use Ctrl+V in the link field.');
    }
  };
  const inspect = async e => {
    e?.preventDefault();
    const current = url.trim();
    if (!current) return setError('Paste a video link to get started.');
    const seq = ++requestSeq.current;
    setInspecting(true);
    setError('');
    setNotice('');
    setVideo(null);
    setJob(null);
    setJobId(null);
    try {
      const data = hostedPreview ? await extensionRequest('inspect', { url: current })
        : await apiRequest('/inspect', { method: 'POST', body: JSON.stringify({ url: current, platform }) });
      if (hostedPreview) setExtensionConnected(true);
      if (seq !== requestSeq.current) return;
      setVideo(data);
      if (data.kind === 'playlist') {
        setPlaylistSelected(data.items.map(item => item.id));
      } else {
        setSelectedHeight((data.resolutions || []).find(h => h > 0) || null);
        setType(data.platform === 'direct' ? 'original' : 'mp4');
        setCollection(data.platform === 'coursera' ? (new URL(current).pathname.match(/\/learn\/([^/]+)/)?.[1] || 'Coursera course').replaceAll('-', ' ') : '');
      }
    } catch (err) {
      if (seq === requestSeq.current) setError(err.message);
    } finally {
      if (seq === requestSeq.current) setInspecting(false);
    }
  };
  const download = async () => {
    if (!video || jobId) return;
    setError('');
    try {
      if (hostedPreview) {
        const started = await extensionRequest('start', {
          url: video.sourceUrl || url.trim(), platform: video.platform, height: selectedHeight || 720,
          type, audioBitrate, title: video.title, kind: video.mediaKind, collection,
        });
        const id = started.jobId || `direct:${started.downloadId}`;
        setJobId(id);
        setJob({ id, status: 'downloading', progress: 0 });
        setNotice('Download started in Chrome! Press Ctrl+J to see the file and its progress.');
      } else {
        const started = await apiRequest('/download', {
          method: 'POST',
          body: JSON.stringify({ url: video.sourceUrl, platform: video.platform, height: selectedHeight, type, audioBitrate, title: video.title, collection }),
        });
        setJobId(started.id);
        setJob({ id: started.id, status: started.status, progress: 0 });
      }
    } catch (e) { setError(e.message); }
  };
  const reset = () => {
    clearResults();
    setUrl('');
    setPlatform('auto');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const videoPlatform = platformByKey(video?.platform || platform);
  const hasVideoQuality = Boolean(video?.resolutions?.some(v => v > 0));
  const activeJob = job && ['queued', 'downloading'].includes(job.status);

  if (auth.loading) return <div className="auth-screen"><div className="auth-card"><div className="auth-brand">clipora<span>.</span></div><LoaderCircle className="spin" size={25} /><p>Connecting to downloader...</p></div></div>;
  if (auth.error) return <div className="auth-screen"><div className="auth-card"><div className="auth-brand">clipora<span>.</span></div><h2>Server unavailable</h2><p>{auth.error}</p><button className="download-action" onClick={() => window.location.reload()}>Retry connection</button></div></div>;
  if (auth.required && !auth.authenticated) return <div className="auth-screen"><form className="auth-card" onSubmit={logIn}>
    <div className="auth-brand">clipora<span>.</span></div><span className="auth-icon"><LockKeyhole size={26}/></span><h2>Welcome back</h2>
    <p>Enter the password configured by the Clipora server owner. Your session is stored in a secure HTTP-only cookie.</p>
    <label htmlFor="access-password">Access password</label>
    <input id="access-password" autoFocus type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={1} placeholder="Enter your access password"/>
    {authError && <div className="auth-error" role="alert">{authError}</div>}
    <button type="submit" className="download-action" disabled={loggingIn}>{loggingIn ? 'Signing in...' : 'Unlock downloader'} <ArrowRight size={17}/></button>
    <span className="auth-note">Public videos you have permission to save only.</span>
  </form></div>;

  return (
    <div id="top" className="site-shell">
      <div className="top-glow" aria-hidden="true" />
      <header className="site-header container">
        <Logo />
        <nav className={`main-nav ${mobileMenu ? 'mobile-open' : ''}`} aria-label="Main navigation">
          <a href="#top" className="nav-active" onClick={() => setMobileMenu(false)}>Home</a>
          <a href="#how-it-works" onClick={() => setMobileMenu(false)}>How it works</a>
          <a href="#platforms" onClick={() => setMobileMenu(false)}>Supported sites</a>
          {!hostedPreview && <a href="#library" onClick={() => setMobileMenu(false)}>My downloads</a>}
          <a href="#browser" onClick={() => setMobileMenu(false)}>Browser</a>
          <a href="#statuses" onClick={() => setMobileMenu(false)}>Status files</a>
          <a href="#downloads" onClick={() => setMobileMenu(false)}>Get apps</a>
          <a href="#extension" onClick={() => setMobileMenu(false)}>Extension</a>
          <a href="#contact" onClick={() => setMobileMenu(false)}>Contact</a>
        </nav>
        {auth.required ? <button className="header-action logout-button" onClick={logOut}><LockKeyhole size={15}/> Sign out</button> : <a className="header-action" href="#downloads"><Download size={16} /> Get Clipora</a>}
        <button type="button" className="mobile-toggle" aria-label={mobileMenu ? 'Close menu' : 'Open menu'} onClick={() => setMobileMenu(!mobileMenu)}>
          {mobileMenu ? <CloseIcon /> : <Menu />}
        </button>
      </header>

      <main>
        {hostedPreview && <aside className="container hosted-banner" role="status"><Info size={21}/><div><strong>The paste-link downloader is back.</strong><p>Install and pair the Clipora browser extension to analyze social-media links here. Local Windows processing is required; Vercel does not run yt-dlp. Mobile packages remain developer previews.</p></div><a href="#downloader">Paste a link <ArrowRight size={15}/></a></aside>}
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-eyebrow"><span className="eyebrow-star"><Sparkles size={14} fill="currentColor" /></span> ONE LINK. ENDLESS POSSIBILITIES. <span className="eyebrow-line" /></div>
          <h1 id="hero-title">Your favorite videos.<br /><span>Ready when you are.</span></h1>
          <p className="hero-subtitle">An easier way to save videos you love. Paste a link, pick your quality, and let Clipora handle the rest.</p>
          <div className="hero-cta-row"><a className="extension-primary-button" href="#downloads"><MonitorDown size={19}/> Get Clipora for your device <ArrowRight size={17}/></a><a className="extension-secondary-button" href={EXTENSION_DOWNLOAD_URL} download="clipora-chrome-edge-extension-v4.zip"><Download size={17}/> Chrome/Edge extension</a></div>
          <div className="hero-stats"><span><CheckCircle2 size={15} /> Simple to use</span><i /><span><CheckCircle2 size={15} /> Quality options</span><i /><span><CheckCircle2 size={15} /> Optional browser extension</span></div>
          <div className="hero-orb hero-orb-one" aria-hidden="true" /><div className="hero-orb hero-orb-two" aria-hidden="true" />
        </section>

        <section className="downloader-wrap container" id="downloader" aria-label="Video download tool">
                    <div className="download-card" ref={formRef}>
            <div className="downloader-topline"><div><span className="live-dot" /> VIDEO DOWNLOADER</div><span className="topline-right"><ShieldCheck size={15} /> Your link, your choice</span></div>
            <div className="downloader-content">
              <div className="tool-heading"><div><h2>Download a video</h2><p>Choose a platform or let us detect it automatically.</p></div><span className="tool-number">01 / 03</span></div>
              <div className="platforms-grid" role="group" aria-label="Select video platform">
                {platforms.slice(0, 6).map(p => (
                  <button key={p.key} type="button" aria-pressed={platform === p.key} onClick={() => { setPlatform(p.key); if (video) clearResults(); }} className={`platform-btn ${platform === p.key ? 'selected' : ''}`}>
                    <span className="platform-icon" style={{ '--platform-color': p.tone }}><PlatformIcon name={p.key} size={18} /></span><span>{p.short}</span>{platform === p.key && <Check className="platform-check" size={12} />}
                  </button>
                ))}
              </div>
              {hostedPreview && <div className="hosted-form-helper"><Info size={18}/><div><strong>Use the same downloader here with the Clipora extension.</strong><p>{extensionConnected ? 'Extension detected. Choose a link and check formats; the local Windows engine handles social videos.' : 'Install the Chrome/Edge extension, start the Windows engine, and pair the extension to enable supported video downloads. Direct images and media files can be saved with the extension.'}</p><a href={EXTENSION_DOWNLOAD_URL} download>Get extension <Download size={14}/></a></div></div>}
              <form className="url-form" onSubmit={inspect}>
                <label htmlFor="video-url">Video URL</label>
                <div className="url-input-wrap"><Link2 size={20} className="url-link-icon" />
                  <input id="video-url" type="url" placeholder="Paste your video link here..." autoComplete="url" spellCheck={false} value={url} onChange={e => updateUrl(e.target.value)} required disabled={inspecting} />
                  <button className="paste-btn" type="button" onClick={paste} disabled={inspecting}><Clipboard size={15} /> Paste</button>
                </div>
                <button className="analyze-btn" type="submit" disabled={inspecting || !url.trim()}>{inspecting ? <><LoaderCircle className="spin" size={20} /> Analyzing video...</> : <><Search size={19} strokeWidth={2.5} /> Find my video <ArrowRight size={19} /></>}</button>
              </form>
              {notice && <div role="status" className="notice-bar"><Info size={16} />{notice}<button aria-label="Dismiss notice" onClick={() => setNotice('')} type="button"><CloseIcon size={15} /></button></div>}
              {error && <div role="alert" className="error-bar"><Info size={19} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')} type="button"><CloseIcon size={16} /></button></div>}
              {diagnostics && (!diagnostics.ytDlp?.installed || !diagnostics.ffmpeg?.installed || !diagnostics.ffprobe?.installed) && <div className="setup-warning" role="alert"><Info size={19}/><div><strong>Server tools need installation</strong><span>Open PowerShell in the project folder and run <code>powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1</code>, then restart the server.</span></div></div>}
              {inspecting && <div className="analysis-loading" role="status"><div className="analysis-ring"><LoaderCircle size={25} className="spin" /></div><div><strong>Finding available formats</strong><span>Connecting to the video provider and checking quality options...</span></div></div>}

              {video?.kind === 'playlist' && <div className="playlist-panel" aria-live="polite">
                <div className="playlist-header"><div className="playlist-badge"><ListVideo size={23}/></div><div><h3>{video.title}</h3><p>{video.items.length} selectable videos {video.truncated && '• showing first items only'}</p></div></div>
                <div className="playlist-toolbar"><button type="button" onClick={() => setPlaylistSelected(video.items.map(item => item.id))}><CheckSquare size={16}/> Select all</button><button type="button" onClick={() => setPlaylistSelected([])}><Square size={16}/> Clear</button><span>{playlistSelected.length} selected</span></div>
                <div className="playlist-items">{video.items.map((item, i) => <label className="playlist-item" key={item.id}>
                  <input type="checkbox" checked={playlistSelected.includes(item.id)} onChange={e => setPlaylistSelected(v => e.target.checked ? [...v, item.id] : v.filter(id => id !== item.id))}/>
                  <img loading="lazy" src={item.thumbnail} alt=""/><div className="playlist-item-info"><strong>{i + 1}. {item.title}</strong><small>{item.duration ? fmtDuration(item.duration) : 'Duration unavailable'}</small></div>
                </label>)}</div>
                <div className="playlist-options"><label>Format<select value={playlistType} onChange={e => setPlaylistType(e.target.value)}><option value="mp4">Video MP4</option><option value="mp3">Audio MP3</option></select></label>
                  {playlistType === 'mp4' ? <label>Maximum resolution<select value={playlistHeight} onChange={e => setPlaylistHeight(Number(e.target.value))}>{[2160,1440,1080,720,480,360,240,144].map(h => <option key={h} value={h}>{h}p</option>)}</select></label> : <label>MP3 bitrate<select value={audioBitrate} onChange={e => setAudioBitrate(Number(e.target.value))}>{[64,96,128,160,192,256,320].map(k => <option key={k} value={k}>{k} kbps</option>)}</select></label>}
                </div><p className="playlist-note">Each video is checked independently. The selected resolution is a maximum, not a promise of that quality. Queue size and file-size limits still apply.</p>
                <button type="button" className="download-action" disabled={!playlistSelected.length || batchBusy} onClick={startBatch}><Download size={18}/>{batchBusy ? 'Adding to queue...' : `Download ${playlistSelected.length} selected items`}</button>
              </div>}
              {video && video.kind !== 'playlist' && <div className="results" aria-live="polite">
                <div className="result-title"><span className="result-complete"><Check size={16} /></span><div><h3>Video found!</h3><p>Choose the format and quality that work best for you.</p></div><button type="button" onClick={reset} className="reset-link"><RotateCcw size={14} /> New link</button></div>
                <div className="result-body">
                  <div className="video-summary">
                    <div className="thumbnail-wrap">
                      {video.thumbnail ? <img src={video.thumbnail} alt="Video preview thumbnail" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <div className="thumbnail-placeholder"><Film size={39} /></div>}
                      {video.duration !== null && <span className="duration-tag"><Clock3 size={11} /> {fmtDuration(video.duration)}</span>}
                      <div className="thumbnail-play"><Play fill="currentColor" size={19} /></div>
                    </div>
                    <div className="video-meta"><div className="video-source"><span style={{ '--platform-color': videoPlatform.tone }}><PlatformIcon name={video.platform} size={15} /></span> {videoPlatform.label}</div><h4 title={video.title}>{video.title}</h4><p>{video.creator}</p><div className="meta-line">{video.viewCount !== null && <span><PlayCircle size={13} /> {fmtCount(video.viewCount)} views</span>}<span><BadgeCheck size={13} /> Source quality</span></div></div>
                  </div>
                  <div className="format-panel">
                    <label className="field-label">Choose format</label>
                    {video.platform === 'direct' ? <div className="audio-hint"><FolderDown size={18}/><span>Save the original {video.mediaKind} file. No quality conversion.</span></div> : <div className="format-switch" role="group" aria-label="File format"><button type="button" aria-pressed={type === 'mp4'} className={type === 'mp4' ? 'on' : ''} disabled={Boolean(jobId)} onClick={() => setType('mp4')}><Film size={16} /> Video <span>MP4</span></button><button type="button" aria-pressed={type === 'mp3'} className={type === 'mp3' ? 'on' : ''} disabled={Boolean(jobId)} onClick={() => setType('mp3')}><Music2 size={16} /> Audio <span>MP3</span></button></div>}
                    {type === 'original' ? null : type === 'mp4' ? <><div className="quality-label"><label className="field-label">Video resolution</label><span>Available from source</span></div>{hasVideoQuality ? <div className="quality-grid" role="group" aria-label="Video resolution">{video.resolutions.filter(h => h > 0).map(h => <button key={h} type="button" disabled={Boolean(jobId)} className={selectedHeight === h ? 'active-quality' : ''} aria-pressed={selectedHeight === h} onClick={() => setSelectedHeight(h)}>{h}p{h >= 2160 && <span className="quality-high">{h >= 4320 ? '8K+' : h >= 2880 ? '5K' : '4K'}</span>}</button>)}</div> : <div className="quality-empty">The provider did not report selectable resolutions. Try audio or another video.</div>}</> : <><div className="audio-hint"><Headphones size={18} /><span>Convert source audio to MP3 at your chosen encoding bitrate. Higher kbps cannot restore lost source quality.</span></div><label className="field-label" htmlFor="bitrate">MP3 bitrate</label><select className="bitrate-select" id="bitrate" disabled={Boolean(jobId)} value={audioBitrate} onChange={e => setAudioBitrate(Number(e.target.value))}>{[64,96,128,160,192,256,320].map(k => <option key={k} value={k}>{k} kbps</option>)}</select></>}
                    <label className="field-label" htmlFor="collection-name">Save under a collection (optional)</label><input className="collection-input" id="collection-name" placeholder="e.g. Programming course, Telegram, Music" maxLength={100} value={collection} disabled={Boolean(jobId)} onChange={e => setCollection(e.target.value)}/>
                    <p className="format-hint"><Info size={13} /> Your actual output may be lower than the selected maximum quality.</p>
                    {!jobId && <button type="button" className="download-action" onClick={download} disabled={type === 'mp4' && !hasVideoQuality}><Download size={19} /> Prepare download <ArrowRight size={17} /></button>}
                    {activeJob && <div className="job-progress" role="status"><div className="progress-head"><strong>{job.status === 'queued' ? 'Queued for download' : 'Preparing your file...'}</strong><span>{Math.round(job.progress || 0)}%</span></div><div className="progress-track"><div style={{ width: `${job.progress || 0}%` }} /></div><p>{job.status === 'queued' ? 'Your video will start processing shortly.' : [job.speed, job.eta && `ETA ${job.eta}`].filter(Boolean).join(' • ') || 'Downloading and merging video/audio on the server...'}</p></div>}
                    {activeJob && <button type="button" className="retry-download" onClick={cancelDownload}><CloseIcon size={15} /> Cancel download</button>}
                    {job?.status === 'ready' && <div className="ready-block"><p><CheckCircle2 size={17} /> Your file is ready! {Number.isFinite(job.sizeBytes) && <span>{fmtBytes(job.sizeBytes)}</span>}</p>{hostedPreview ? <span className="chrome-save-hint">Saved in Chrome Downloads. Open Chrome Downloads (Ctrl+J) to find the file.</span> : <a className="download-action ready-action" href={job.downloadUrl} download><ArrowDownToLine size={19} /> Save to device <ArrowRight size={17} /></a>}</div>}{!hostedPreview && <label style={{display:'flex',alignItems:'center',gap:9,marginTop:12,fontSize:12,color:'#668580'}}><input type="checkbox" checked={autoSave} onChange={e=>{setAutoSave(e.target.checked);localStorage.setItem('cliporaAutoSave',e.target.checked?'1':'0');}}/> Automatically send completed downloads to Chrome Downloads</label>}
                    {['error', 'cancelled'].includes(job?.status) && <button className="retry-download" type="button" onClick={() => { setJobId(null); setJob(null); setError(''); }}><RotateCcw size={16} /> Try again</button>}
                  </div>
                </div>
              </div>}

              {!video && !inspecting && <div className="form-bottom"><span><LockKeyhole size={16} /> Publicly accessible content only</span><span><Zap size={16} /> Quality depends on the original video</span></div>}
            </div>
          </div>
          <div className="below-tool-caption"><ShieldCheck size={15} /> Download only videos you own, are licensed to use, or have permission to save. <span>Services may restrict access.</span></div>
        </section>

        <section className="downloads-section container" id="downloads" aria-labelledby="downloads-heading">
          <div className="downloads-heading"><span className="section-overline">INSTALL CLIPORA</span><h2 id="downloads-heading">Choose your <span>device.</span></h2><p>Get the source and setup files for Windows, Android, and iPhone—or install the browser extension. Check the package type before downloading.</p></div>
          <div className="device-download-grid">
            <article className="device-download-card device-download-desktop"><div className="device-card-heading"><span className="device-icon"><MonitorDown size={25}/></span><span className="device-platform">WINDOWS 10 / 11</span></div><h3>Desktop downloader</h3><p>Runs the yt-dlp and FFmpeg engine on your Windows computer. Includes setup and start scripts, the React UI and backend.</p><span className="device-package-type">Source ZIP · Node.js 22.12+ required</span><a className="device-download-btn" href={DESKTOP_SOURCE_URL} download="clipora-desktop-windows-source-v4.zip"><Download size={17}/> Download Windows package</a><small>Not a compiled .exe installer. Run SETUP-CLIPORA.cmd once, then START-CLIPORA.cmd.</small></article>
            <article className="device-download-card"><div className="device-card-heading"><span className="device-icon"><MonitorDown size={25}/></span><span className="device-platform">ANDROID</span></div><h3>Android app project</h3><p>Standalone on-device React Native source, with direct-file downloads and an experimental native extractor integration.</p><span className="device-package-type">Developer preview · Source ZIP</span><a className="device-download-btn" href={MOBILE_SOURCE_URL} download="clipora-mobile-android-ios-source.zip"><Download size={17}/> Download Android source</a><small>No verified APK provided. Build the native Android app using the instructions in the ZIP.</small></article>
            <article className="device-download-card"><div className="device-card-heading"><span className="device-icon"><MonitorDown size={25}/></span><span className="device-platform">APPLE IPHONE</span></div><h3>iPhone app project</h3><p>React Native iOS source for on-device direct media downloads and a local saved-file library.</p><span className="device-package-type">Developer preview · Source ZIP</span><a className="device-download-btn" href={MOBILE_SOURCE_URL} download="clipora-mobile-android-ios-source.zip"><Download size={17}/> Download iOS source</a><small>No signed IPA provided. iOS social-site extraction and playlist conversion are not implemented.</small></article>
            <article className="device-download-card"><div className="device-card-heading"><span className="device-icon"><Globe2 size={25}/></span><span className="device-platform">CHROME / EDGE</span></div><h3>Browser extension</h3><p>Paste links or add download buttons to discoverable media on webpages. Pairs with the Windows engine for supported social sites.</p><span className="device-package-type">Unpacked browser extension ZIP</span><a className="device-download-btn" href={EXTENSION_DOWNLOAD_URL} download="clipora-chrome-edge-extension-v4.zip"><Download size={17}/> Download extension</a><small>Manual installation required in Developer mode. Not a Chrome Web Store installation.</small></article>
          </div>
          <div className="download-install-note"><ShieldCheck size={18}/><p>Clipora works with public or authorized media only. This page distributes source packages; it does not itself process social-media videos. Android native extraction is experimental, and the mobile projects need compilation and signing.</p></div>
        </section>
        <section className="extension-section container" id="extension" aria-labelledby="extension-heading">
          <div className="extension-card">
            <div className="extension-copy">
              <span className="section-overline">YOUR BROWSER, YOUR DOWNLOADER</span>
              <h2 id="extension-heading">Save media without leaving <span>your browser.</span></h2>
              <p>Get the Clipora Chrome &amp; Edge extension to paste links, choose available video quality or MP3 bitrate, and show buttons on supported images and videos. Files appear in Chrome Downloads.</p>
              <div className="extension-actions"><a className="extension-primary-button" href={EXTENSION_DOWNLOAD_URL} download="clipora-chrome-edge-extension-v4.zip"><Download size={19}/> Download extension ZIP</a><a className="extension-source-link" href={PUBLIC_REPO + '/browser-extension'} target="_blank" rel="noopener noreferrer">View source <ExternalLink size={15}/></a></div>
              <small>Version 4.0 · Chrome / Microsoft Edge desktop · Free to install · Requires manual approval</small>
            </div>
            <div className="extension-install">
              <h3><MonitorDown size={20}/> Install in 3 steps</h3>
              <ol>
                <li><span>1</span><p><strong>Download &amp; extract</strong> Unzip the file on your computer.</p></li>
                <li><span>2</span><p><strong>Open extensions</strong> Visit <code>chrome://extensions</code> or <code>edge://extensions</code>, enable Developer mode, then choose “Load unpacked”.</p></li>
                <li><span>3</span><p><strong>Choose folder &amp; pair</strong> Select <code>Clipora-Extension</code>. Start Clipora's local engine and enter its pairing code for social-media downloads.</p></li>
              </ol>
              <p className="extension-install-note"><Info size={15}/> Chrome does not install extensions automatically from websites. Some direct files download without the engine; social-media extraction needs the Clipora desktop server.</p>
            </div>
          </div>
        </section>
        {!hostedPreview && <section className="workspace-section container" id="library">
          <div className="workspace-heading"><div><span className="section-overline">YOUR FILES</span><h2><FolderOpen size={30}/> Download library</h2><p>Completed files remain available until server cleanup; grouped by website and collection.</p></div><span className="workspace-count">{library.filter(j=>j.status==='ready').length} ready</span></div>
          <div className="workspace-panel"><div className="library-filters"><div className="library-search"><Search size={17}/><input placeholder="Search title, source, or collection..." value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)}/></div><select aria-label="Filter status" value={libraryStatus} onChange={e=>setLibraryStatus(e.target.value)}><option value="all">All statuses</option><option value="ready">Ready</option><option value="downloading">Downloading</option><option value="queued">Queued</option><option value="error">Failed</option></select></div>
          {library.length === 0 ? <div className="workspace-empty"><FolderOpen size={33}/><strong>No downloads yet</strong><p>Files you prepare will appear here. Playlists are grouped into their own collections.</p></div> : <div className="library-groups">{Object.entries(library.filter(j=>(libraryStatus==='all'||j.status===libraryStatus) && `${j.title} ${j.platform} ${j.collection||''}`.toLowerCase().includes(librarySearch.toLowerCase())).reduce((out,j)=>{const key=j.collection ? `${j.platform} / ${j.collection}` : j.platform; (out[key] ||= []).push(j); return out;},{})).map(([group,items])=><div className="library-group" key={group}><h3><Layers3 size={17}/>{group}<span>{items.length}</span></h3>{items.map(j=><div key={j.id} className="library-row"><span className="library-type">{j.type==='mp3'?<Music2 size={18}/>:j.type==='original'?<ImageIcon size={18}/>:<Film size={18}/>}</span><div className="library-info"><strong title={j.title}>{j.title}</strong><small>{j.status} {j.progress>0 && j.progress<100?`• ${Math.round(j.progress)}%`:''} {j.sizeBytes?`• ${fmtBytes(j.sizeBytes)}`:''}</small>{['queued','downloading'].includes(j.status)&&<div className="library-progress"><div style={{width:`${j.progress||0}%`}}/></div>}</div>{j.status==='ready'?<a href={j.downloadUrl} download className="library-save"><Download size={16}/> Save</a>:null}</div>)}</div>)}</div>}</div>
        </section>}
        <section className="workspace-section container" id="browser">
          <div className="workspace-heading"><div><span className="section-overline">DISCOVER MEDIA</span><h2><Globe2 size={30}/> Media browser</h2><p>Open public sites and send supported video links to Clipora. An optional extension adds image/video buttons on pages you visit.</p></div></div>
          <div className="workspace-panel"><form className="google-search-form" action="https://www.google.com/search" target="_blank" rel="noopener noreferrer" method="get"><Search size={18}/><input type="search" placeholder="Search Google Videos…" name="q" value={googleQuery} onChange={e=>setGoogleQuery(e.target.value)}/><input type="hidden" name="tbm" value="vid"/><button type="submit">Search videos</button></form><form className="browser-bar" onSubmit={openBrowser}><Globe2 size={18}/><input type="url" aria-label="Site URL" value={browserAddress} onChange={e=>setBrowserAddress(e.target.value)} placeholder="https://example.com"/><button type="submit">{hostedPreview ? "Open site" : "Open preview"}</button><a rel="noopener noreferrer" target="_blank" href={browserAddress.startsWith('https://') ? browserAddress : 'https://www.google.com'} title="Open in your browser"><ExternalLink size={17}/></a></form>
          <div className="browser-hint"><Info size={16}/><span>Some websites refuse iframe embedding. Clipora cannot read another site's page content from React. <a className="browser-extension-link" href={EXTENSION_DOWNLOAD_URL} download="clipora-chrome-edge-extension-v4.zip">Download the Chrome/Edge extension</a> to add download buttons to supported public media.</span></div>
          {browserPage && hostedPreview ? <div className="browser-placeholder"><ExternalLink size={35}/><h3>Browse directly in your browser</h3><p>Most social websites block embedded previews. Open the page in a new tab, then use Clipora’s desktop extension if it supports the media.</p><a className="device-download-btn" href={browserPage} target="_blank" rel="noopener noreferrer">Open website <ExternalLink size={16}/></a></div> : browserPage?<div className="browser-frame"><iframe title="Website preview" src={browserPage} sandbox="allow-forms allow-scripts allow-same-origin allow-popups" referrerPolicy="no-referrer"/><div className="browser-frame-footer"><span>Preview blocked? Use the external-tab button instead.</span><button onClick={useBrowserUrl} type="button"><Download size={16}/> Analyze current URL</button></div></div>:<div className="browser-placeholder"><PanelTopOpen size={38}/><h3>Explore supported public websites</h3><p>Paste a site address and open a preview or browse normally with the extension.</p></div>}</div>
        </section>
        <section className="workspace-section container" id="statuses">
          <div className="workspace-heading"><div><span className="section-overline">LOCAL MEDIA</span><h2><ImageIcon size={30}/> WhatsApp status files</h2><p>View and save status files that you already have permission to access on your device. No WhatsApp account scraping.</p></div><button type="button" className="workspace-primary" onClick={openStatuses}><FolderOpen size={17}/> Choose status folder</button></div>
          <div className="workspace-panel">{statusNotice&&<div className="browser-hint" role="status"><Info size={16}/>{statusNotice}</div>}{!statusItems.length?<div className="workspace-empty"><FolderOpen size={32}/><strong>Select a local folder</strong><p>Chrome/Edge will request permission. Select your existing .Statuses folder or any folder containing files you may save. Mobile WhatsApp storage is not directly accessible from a web page.</p></div>:<div className="status-grid">{statusItems.map(item=><div className="status-card" key={item.name}>{item.media==='image'?<img src={item.href} alt={item.name}/>:<video src={item.href} controls preload="metadata"/>}<div><small title={item.name}>{item.name}</small><a href={item.href} download={item.name}><Download size={15}/> Save</a></div></div>)}</div>}</div>
        </section>
        <section className="platform-section container" id="platforms">
          <div className="section-overline">WORKS ACROSS YOUR FAVORITE PLATFORMS</div>
          <div className="section-flex"><div><h2>One place for <span>every platform.</span></h2><p>No switching between download tools. On your Windows installation, Clipora can check supported links and list available formats.</p></div><a className="text-link" href={hostedPreview ? '#downloads' : '#downloader'}>{hostedPreview ? 'Get the app' : 'Try it now'} <ArrowRight size={17} /></a></div>
          <div className="brand-cards">{platforms.filter(p => p.key !== 'auto').map(p => <button key={p.key} type="button" className="brand-card" onClick={() => { if (hostedPreview) { window.location.hash = '#downloads'; return; } setPlatform(p.key); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}><span className="brand-card-icon" style={{ '--platform-color': p.tone }}><PlatformIcon name={p.key} size={23} /></span><strong>{p.label}</strong><span>{hostedPreview ? 'Get app' : 'Explore'} <ArrowRight size={14} /></span></button>)}</div>
          <p className="brand-footnote"><Info size={14} /> Individual videos may fail because of privacy settings, authentication, DRM, or provider changes.</p>
        </section>

        <section className="how-section" id="how-it-works"><div className="container how-container"><div className="section-overline">SO SIMPLE, IT'S ALMOST MAGIC</div><h2>Three steps to your <span>next download.</span></h2><p className="how-lead">No confusing settings. Just the essentials, built into a clean and easy experience.</p>
          <div className="step-grid">
            <div className="step-card"><div className="step-illustration step-first"><div className="floating-url"><Link2 size={20}/><span>https://your-video-link...</span><CheckCircle2 size={19}/></div><span className="step-ring"><Clipboard size={25}/></span></div><div className="step-count">STEP 01 <span>—</span></div><h3>Copy & paste</h3><p>Grab the video URL from a supported social platform and paste it into Clipora.</p></div>
            <div className="step-card"><div className="step-illustration step-second"><span className="sample-choice"><Check size={15} /> 1080p</span><span className="sample-choice sample-inactive">720p</span><span className="sample-choice sample-inactive">480p</span></div><div className="step-count">STEP 02 <span>—</span></div><h3>Pick your quality</h3><p>Review the available resolutions and choose MP4 video or MP3 audio.</p></div>
            <div className="step-card"><div className="step-illustration step-third"><span className="illustration-down"><ArrowDownToLine size={34}/></span><div className="illustration-bars"><span/><span/><span/></div><div className="illustration-ready"><Check size={13} /> File ready</div></div><div className="step-count">STEP 03 <span>—</span></div><h3>Save & enjoy</h3><p>Clipora prepares your file on the server, then lets you save it to your device.</p></div>
          </div>
        </div></section>

        <section className="features-section container"><div className="feature-banner"><div className="banner-copy"><div className="section-overline">BUILT FOR A SMOOTHER EXPERIENCE</div><h2>Everything you need.<br /><span>Nothing you don't.</span></h2><p>From quick clips to longer videos, our streamlined interface keeps you in control.</p><a href={hostedPreview ? '#downloads' : '#downloader'} className="banner-link">{hostedPreview ? 'Choose a download' : 'Get started for free'} <ArrowRight size={17} /></a></div><div className="banner-features"><div><span><MonitorDown size={23}/></span><strong>Multiple resolutions</strong><p>Choose among qualities reported by the source.</p></div><div><span><CloudDownload size={23}/></span><strong>Large-file delivery</strong><p>Disk-backed downloads instead of loading whole files in memory.</p></div><div><span><ShieldCheck size={23}/></span><strong>Private by design</strong><p>Temporary files are automatically cleaned up.</p></div></div></div></section>

        <section className="faq-section container" id="questions"><div className="section-overline">GOOD TO KNOW</div><h2>Frequently asked <span>questions.</span></h2><div className="faq-grid"><details><summary>Is Clipora free to use?<ChevronDown size={19} /></summary><p>The project is self-hosted and has no built-in payments. Your server, bandwidth, and storage may have costs.</p></details><details><summary>Can I download in 1080p, 4K or 5K?<ChevronDown size={19} /></summary><p>Only when the source offers that quality and the extractor can access it. Clipora displays the resolutions reported by the video provider; selecting a resolution sets an upper limit.</p></details><details><summary>Can I download private videos?<ChevronDown size={19} /></summary><p>No. This implementation is meant for publicly accessible content you have permission to download. It does not bypass logins, DRM, or access controls.</p></details><details><summary>Why did a download fail?<ChevronDown size={19} /></summary><p>Platforms frequently change their video delivery systems. Some links require authentication, contain DRM, or are not supported by the current extractor version.</p></details></div></section>
      </main>
      <footer className="footer" id="contact"><div className="container footer-main"><div><Logo inverted /><p>Good videos deserve a great way to save them.</p><p className="owner-credit">Created by <strong>Munir Rahman Rahmani</strong></p></div><div className="contact-box"><span className="contact-eyebrow">HAVE A QUESTION OR IDEA?</span><h3>Get in touch.</h3><p>Questions about Clipora, contributions, or a custom implementation are welcome.</p><a className="contact-mail" href={`mailto:${PUBLIC_CONTACT_EMAIL}`}><Send size={17}/>{PUBLIC_CONTACT_EMAIL}</a><a className="contact-github" target="_blank" rel="noreferrer" href={PUBLIC_REPO}>Open source on GitHub <ExternalLink size={15}/></a></div><div className="footer-links"><a href="#top">Home</a><a href="#how-it-works">How it works</a><a href="#platforms">Platforms</a><a href="#questions">FAQ</a><a href="#contact">Contact</a></div></div><div className="footer-bottom container"><span>© {new Date().getFullYear()} Clipora · Munir Rahman Rahmani · Media you have rights to save.</span><a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>Email the developer</a></div></footer>
    </div>
  );
}
export default App;
