"""Offline safety/metadata checks for the Vercel Python endpoint."""
import importlib.util
import pathlib
import socket
import sys
import types
import unittest
from unittest.mock import patch

fake = types.ModuleType('yt_dlp')
fake.YoutubeDL = object
fake_utils = types.ModuleType('yt_dlp.utils')
fake_utils.DownloadError = type('DownloadError', (Exception,), {})
sys.modules.setdefault('yt_dlp', fake)
sys.modules.setdefault('yt_dlp.utils', fake_utils)
file = pathlib.Path(__file__).resolve().parents[1] / 'api' / 'hosted.py'
spec = importlib.util.spec_from_file_location('clipora_hosted', file)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class HostedTests(unittest.TestCase):
    def test_rejects_unsupported_or_private_urls(self):
        for url in ['http://youtube.com/watch?v=a', 'https://localhost/x.mp4',
                    'https://youtube.com.evil.org/', 'https://127.0.0.1/video',
                    'file:///etc/hosts', 'https://user:pass@youtube.com/video']:
            with self.subTest(url=url), self.assertRaises(module.ClientError):
                module.validate_url(url)

    def test_accepted_youtube_with_public_dns(self):
        ans = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('142.250.64.78', 443))]
        with patch.object(module.socket, 'getaddrinfo', return_value=ans):
            self.assertEqual(module.validate_url('https://youtu.be/abc123')[1], 'youtube')

    def test_dns_private_address_is_rejected(self):
        for address in ['127.0.0.1', '10.0.0.8', '192.168.1.1', '::1']:
            with patch.object(module.socket, 'getaddrinfo', return_value=[(0,0,0,'',(address,443))]):
                with self.assertRaises(module.ClientError):
                    module.validate_url('https://youtube.com/watch?v=abc')

    def test_rejects_long_and_live_media(self):
        for obj in [{'duration': 1500}, {'is_live': True}, {'_type': 'playlist'}]:
            with self.assertRaises(module.ClientError):
                module.check_metadata(obj)

    def test_metadata_outputs_real_resolutions(self):
        info = {'title':'Demo', 'duration':45, 'formats':[
            {'height':360,'vcodec':'avc1'}, {'height':720,'vcodec':'avc1'},
            {'height':720,'vcodec':'avc1'}, {'height':1440,'vcodec':'vp09'},
            {'height':None,'vcodec':'none'}]}
        obj = module.metadata_response('https://youtu.be/demo','youtube',info)
        self.assertEqual(obj['resolutions'], [720, 360])
        self.assertEqual(obj['kind'], 'single')
        self.assertEqual(obj['hostedLimits']['maxMB'],60)

    def test_safe_filename(self):
        self.assertEqual(module.sanitize_filename('../test:video?'), 'test-video')
        self.assertEqual(module.sanitize_filename(''), 'clipora-video')

if __name__=='__main__': unittest.main()
