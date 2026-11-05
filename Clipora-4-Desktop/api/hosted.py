"""Bounded, extension-free Clipora hosted downloader.

This Vercel Function is deliberately NOT an arbitrary URL proxy. Social sites may
reject cloud IPs or change their extraction methods. Files and CPU time are capped.
"""
import ipaddress
import json
import os
import re
import shutil
import socket
import tempfile
import time
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, quote

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

MAX_OUTPUT_BYTES = 60 * 1024 * 1024
MAX_DURATION_SECONDS = 600
MAX_RESOLUTION = 1080
VALID_BITRATES = {64, 96, 128, 160, 192, 256, 320}
ALLOWED = {
    'youtube.com': 'youtube', 'youtu.be': 'youtube', 'youtube-nocookie.com': 'youtube',
    'instagram.com': 'instagram', 'tiktok.com': 'tiktok', 'facebook.com': 'facebook',
    'fb.watch': 'facebook', 'x.com': 'twitter', 'twitter.com': 'twitter',
    'vimeo.com': 'vimeo', 'reddit.com': 'reddit', 'redd.it': 'reddit',
    'pinterest.com': 'pinterest', 'pin.it': 'pinterest', 'dailymotion.com': 'dailymotion',
    'twitch.tv': 'twitch', 'linkedin.com': 'linkedin', 'capcut.com': 'capcut',
    'coursera.org': 'coursera', 't.me': 'telegram', 'telegram.me': 'telegram',
}
# This is a best-effort per-worker brake, not a distributed rate limiter. Configure
# rate limiting/WAF upstream before allowing untrusted high-volume usage.
RECENT = {}


class ClientError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def validate_url(value):
    if not isinstance(value, str) or len(value) > 2300:
        raise ClientError('Enter a valid public HTTPS video URL.')
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or '').rstrip('.').lower()
        if parsed.scheme != 'https' or parsed.port or parsed.username or parsed.password:
            raise ValueError()
        if not re.fullmatch(r'[a-z0-9.-]{4,255}', host):
            raise ValueError()
    except (ValueError, TypeError):
        raise ClientError('Enter a valid public HTTPS video URL.')
    platform = next((name for domain, name in ALLOWED.items() if host == domain or host.endswith('.' + domain)), None)
    if not platform:
        raise ClientError('Hosted mode supports specific public video platforms only. For other websites, use Clipora Desktop.', 422)
    if host in {'localhost', 'localhost.localdomain'}:
        raise ClientError('Private addresses are not supported.', 422)
    # Reject DNS entries that point to loopback, LAN, link-local or reserved IPs.
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        if not infos or any(not ipaddress.ip_address(item[4][0]).is_global for item in infos):
            raise ClientError('The provider hostname did not resolve to a public address.', 422)
    except socket.gaierror:
        raise ClientError('Cannot resolve the provider host.', 422)
    if parsed.path.startswith('/playlist') and platform == 'youtube':
        raise ClientError('Hosted mode currently supports individual videos, not entire playlists.', 422)
    return value, platform


def throttle(addr, action):
    now = time.monotonic()
    key = (addr, action)
    window = 60
    times = [t for t in RECENT.get(key, []) if now - t < window]
    limit = 8 if action == 'inspect' else 3
    if len(times) >= limit:
        raise ClientError('Too many requests. Try again in a minute.', 429)
    times.append(now)
    RECENT[key] = times
    if len(RECENT) > 1500:
        RECENT.clear()


def common_options():
    opts = {
        'quiet': True, 'no_warnings': True, 'noplaylist': True,
        'skip_download': True, 'socket_timeout': 15, 'retries': 1,
        'fragment_retries': 1, 'ignoreerrors': False, 'cachedir': False,
        'extract_flat': False, 'geo_bypass': False,
        'nocheckcertificate': False,
        'http_headers': {'User-Agent': 'Mozilla/5.0 (compatible; Clipora/4.2)'},
    }
    # The EJS solver installed via yt-dlp[default] can use the Node runtime when
    # Node is available in the deployment; otherwise extractors may be limited.
    if shutil.which('node'):
        opts['js_runtimes'] = {'node': {'executable': shutil.which('node')}}
    return opts


def check_metadata(meta):
    if not isinstance(meta, dict) or meta.get('_type') in ('playlist', 'multi_video'):
        raise ClientError('This hosted downloader accepts one video at a time.', 422)
    if meta.get('is_live') or meta.get('live_status') in ('is_live', 'is_upcoming'):
        raise ClientError('Live streams are not supported in hosted mode.', 422)
    duration = meta.get('duration')
    if isinstance(duration, (float, int)) and duration > MAX_DURATION_SECONDS:
        raise ClientError('This video is too long for the hosted service (10-minute limit). Use the desktop engine.', 413)
    return meta


def inspect_metadata(url):
    opts = common_options()
    with YoutubeDL(opts) as ydl:
        info = check_metadata(ydl.extract_info(url, download=False))
    return info


def metadata_response(url, platform, info):
    fmt = info.get('formats') or []
    heights = {int(f['height']) for f in fmt if isinstance(f, dict)
               and isinstance(f.get('height'), (float, int)) and 144 <= f['height'] <= MAX_RESOLUTION
               and f.get('vcodec') not in (None, 'none')}
    if not heights and isinstance(info.get('height'), int):
        heights.add(min(info['height'], MAX_RESOLUTION))
    thumb = info.get('thumbnail', '')
    if not isinstance(thumb, str) or not thumb.startswith('https://'):
        thumb = None
    ffmpeg_available = bool(shutil.which('ffmpeg'))
    progressive = {int(f['height']) for f in fmt if isinstance(f, dict)
                   and isinstance(f.get('height'), (int, float)) and 144 <= f['height'] <= MAX_RESOLUTION
                   and f.get('vcodec') not in (None, 'none')
                   and f.get('acodec') not in (None, 'none') and f.get('ext') == 'mp4'}
    if not ffmpeg_available:
        heights = progressive
    return {
        'kind': 'single', 'platform': platform,
        'title': str(info.get('title') or 'Untitled').strip()[:180],
        'creator': str(info.get('uploader') or info.get('channel') or platform)[:100],
        'thumbnail': thumb,
        'duration': int(info['duration']) if isinstance(info.get('duration'), (float, int)) else None,
        'viewCount': info.get('view_count') if isinstance(info.get('view_count'), int) else None,
        'resolutions': sorted(heights, reverse=True),
        'sourceUrl': url, 'sourceFormat': info.get('ext'),
        'hostedLimits': {'maxMinutes': 10, 'maxMB': 60, 'maxHeight': MAX_RESOLUTION},
        'hostedAudioFormat': 'mp3' if ffmpeg_available else 'm4a',
        'hostedCanConvert': ffmpeg_available,
    }


def sanitize_filename(name):
    title = str(name or 'clipora-video')
    title = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '-', title).strip(' .-')[:110]
    return title or 'clipora-video'


def download_one(url, file_type, height, bitrate):
    if file_type not in ('mp4', 'mp3', 'm4a'):
        raise ClientError('Choose MP4 video, MP3 audio, or original M4A audio.')
    try:
        height = int(height)
        bitrate = int(bitrate)
    except (ValueError, TypeError):
        raise ClientError('Invalid quality selection.')
    if height not in (144, 240, 360, 480, 720, 1080) or bitrate not in VALID_BITRATES:
        raise ClientError('Invalid quality selection.')
    info = inspect_metadata(url)
    workdir = tempfile.mkdtemp(prefix='clipora-', dir='/tmp')
    target = str(Path(workdir) / '%(id).100s.%(ext)s')
    downloaded = [0]

    def limit_progress(event):
        if event.get('status') == 'downloading':
            total = int(event.get('downloaded_bytes') or 0)
            downloaded[0] = max(downloaded[0], total)
            if downloaded[0] > MAX_OUTPUT_BYTES:
                raise ClientError('Download exceeds the 60 MB hosted limit. Use Clipora Desktop.', 413)

    opts = common_options()
    opts.update({
        'skip_download': False, 'outtmpl': target,
        'overwrites': True, 'max_filesize': MAX_OUTPUT_BYTES,
        'progress_hooks': [limit_progress],
        'nopart': True,
    })
    ffmpeg_location = shutil.which('ffmpeg')
    if ffmpeg_location:
        opts['ffmpeg_location'] = ffmpeg_location
    elif file_type == 'mp3':
        shutil.rmtree(workdir, ignore_errors=True)
        raise ClientError('Hosted audio is available as original M4A rather than converted MP3. Use Clipora Desktop for MP3.', 422)
    if file_type == 'mp3':
        opts['format'] = 'bestaudio/best'
        opts['postprocessors'] = [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': str(bitrate)}]
    elif file_type == 'm4a':
        opts['format'] = 'bestaudio[ext=m4a]'
    elif ffmpeg_location:
        opts['format'] = (f'bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]'
                          f'/best[ext=mp4][height<={height}]')
        opts['merge_output_format'] = 'mp4'
    else:
        # No FFmpeg in Vercel: progressive MP4 already contains video and audio.
        opts['format'] = f'best[ext=mp4][height<={height}][vcodec!=none][acodec!=none]'
    try:
        with YoutubeDL(opts) as ydl:
            ydl.download([url])
        files = [p for p in Path(workdir).iterdir() if p.is_file() and p.suffix.lower() == '.' + file_type]
        if len(files) != 1:
            raise ClientError('The provider did not produce the requested format. Try a lower quality or use Desktop.', 422)
        file_path = files[0]
        if file_path.stat().st_size > MAX_OUTPUT_BYTES:
            raise ClientError('This file exceeds the 60 MB hosted limit. Use Clipora Desktop.', 413)
        output_name = sanitize_filename(info.get('title')) + '.' + file_type
        return workdir, file_path, output_name
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise


class handler(BaseHTTPRequestHandler):
    def reply(self, code, data):
        raw = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(raw)

    def remote_address(self):
        return (self.headers.get('x-vercel-forwarded-for') or self.client_address[0]).split(',')[0].strip()[:64]

    def do_POST(self):
        try:
            throttle(self.remote_address(), 'inspect')
            if int(self.headers.get('Content-Length') or 0) > 4000:
                raise ClientError('Request too large.', 413)
            data = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)))
            url, platform = validate_url(data.get('url'))
            meta = inspect_metadata(url)
            self.reply(200, metadata_response(url, platform, meta))
        except ClientError as e:
            self.reply(e.status, {'error': str(e)})
        except (DownloadError, Exception) as e:
            self.reply(502, {'error': 'Unable to read this video from the hosted server. It may be restricted, unsupported, or blocked by the provider.'})

    def do_GET(self):
        query = parse_qs(urlsplit(self.path).query)
        if query.get('action', [''])[0] == 'health':
            return self.reply(200, {'ok': True, 'mode': 'hosted', 'maxMB': 60, 'maxMinutes': 10})
        try:
            throttle(self.remote_address(), 'download')
            url, _ = validate_url(query.get('url', [''])[0])
            file_type = query.get('type', ['mp4'])[0]
            workdir, file_path, output_name = download_one(url, file_type,
                query.get('height', ['720'])[0], query.get('bitrate', ['192'])[0])
            try:
                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg' if file_type == 'mp3' else 'audio/mp4' if file_type == 'm4a' else 'video/mp4')
                self.send_header('Content-Length', str(file_path.stat().st_size))
                self.send_header('Content-Disposition', "attachment; filename*=UTF-8''" + quote(output_name))
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                with file_path.open('rb') as stream:
                    while chunk := stream.read(128 * 1024):
                        self.wfile.write(chunk)
            finally:
                shutil.rmtree(workdir, ignore_errors=True)
        except ClientError as e:
            self.reply(e.status, {'error': str(e)})
        except Exception:
            self.reply(502, {'error': 'This download could not be completed from the hosted server. Try the desktop app.'})
