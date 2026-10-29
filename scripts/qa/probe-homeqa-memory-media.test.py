"""Offline security/cleanup regressions. Every credential below is synthetic."""
import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('probe', pathlib.Path(__file__).with_name('probe-homeqa-memory-media.py'))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class ProbeTests(unittest.TestCase):
    def test_media_scope_rejects_wrong_destination_and_paths(self):
        source = {'port': 18082, 'stream': 'dvr_0123456789abcdef01_1'}
        url = 'http://127.0.0.1:18082/hls/dvr_0123456789abcdef01_1/index.m3u8'
        self.assertTrue(probe.media_allowed(source, url))
        for bad in (url.replace('18082', '18083'), url.replace('127.0.0.1', 'example.com'),
                    url.replace('127.0.0.1', 'user:password@127.0.0.1'),
                    url.replace('_1/index', '_2/index'), url.replace('index.m3u8', '../index.m3u8'), url+'#fragment'):
            with self.subTest(url=bad):
                self.assertFalse(probe.media_allowed(source, bad))

    def test_expired_budget_prevents_network_request(self):
        with patch.object(probe, 'DEADLINE', 0), patch.object(probe.OPENER, 'open') as network:
            with self.assertRaisesRegex(AssertionError, 'QA_WINDOW_EXPIRED'):
                probe.call(probe.AUTH+'/auth/v1/user')
            network.assert_not_called()

    def run_fixture(self, refresh_status, interrupted=False):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            secret, output = root/'identity.json', root/'report.json'
            identity = {'protocol': 'observer-push38-remote-client-secret-v1', 'user_id': 'synthetic-user',
                        'email': 'synthetic@example.invalid', 'password': 'SYNTHETIC_PASSWORD_ONLY'}
            secret.write_text(json.dumps(identity)); secret.chmod(0o600)
            logout_headers = []
            def command(args, **_kwargs):
                if args[0] == 'supabase':
                    self.assertEqual(_kwargs['env']['DOCKER_CONTEXT'], 'colima-push38t')
                    return 'API_URL="http://127.0.0.1:56421"\nPUBLISHABLE_KEY="SYNTHETIC_PUBLIC_KEY"\n'
                if args[1:3] == ['context', 'inspect']:
                    return json.dumps([{'Endpoints': {'docker': {'Host': 'unix://'+str(pathlib.Path.home()/'.colima/push38t/docker.sock')}}}])
                return 'gan-batuach-push38t\n'
            def request(url, body=None, headers=None, **_kwargs):
                if 'grant_type=password' in url:
                    return 200, {'access_token': 'SYNTHETIC_ACCESS', 'refresh_token': 'SYNTHETIC_REFRESH', 'user': {'id': identity['user_id']}}
                if 'grant_type=refresh_token' in url:
                    return refresh_status, {'access_token': 'SYNTHETIC_RENEWED', 'user': {'id': identity['user_id']}}
                if '/logout?' in url:
                    logout_headers.append(headers); return 204, {}
                if url.endswith('/user'):
                    return 200, {'id': identity['user_id']}
                rows=[]
                for channel in range(1, 17):
                    rows.append({'id': str(channel), 'connector_type': 'private_dvr_gateway', 'metadata': {
                        'channel_assignment': 'ASSIGNED' if channel in (1,2,3,4,5,6,7,8,10,11) else 'CHANNEL_EMPTY',
                        'gateway_id': '62df97e2-3c0b-427f-9108-bde029bc10e7', 'dvr_channel': channel,
                        'gateway_stream_id': 'dvr_0123456789abcdef01_'+str(channel)}})
                rows.append({'id': 'tapo', 'connector_type': 'rtsp', 'metadata': {'channel_assignment': 'ASSIGNED',
                    'gateway_id': 'db267b52-6282-4944-bcee-5d4857698fb0', 'dvr_channel': 1,
                    'gateway_stream_id': 'dvr_0123456789abcdef01_1'}})
                return 200, rows
            stdout = io.StringIO()
            def decode(source, _access):
                if interrupted:
                    raise RuntimeError('QA_INTERRUPTED')
                return {'label': source['label'], 'passed': True}
            with patch.object(probe, 'SECRET', secret), patch.object(probe, 'OUTPUT', output), \
                    patch.object(probe.subprocess, 'check_output', side_effect=command), \
                    patch.object(probe, 'call', side_effect=request), \
                    patch.object(probe, 'decode_sample', side_effect=decode), \
                    patch.object(probe.time, 'sleep'), contextlib.redirect_stdout(stdout):
                probe.main()
            report = json.loads(output.read_text())
            for sensitive in ('SYNTHETIC_PASSWORD_ONLY', 'SYNTHETIC_ACCESS', 'SYNTHETIC_REFRESH', 'SYNTHETIC_RENEWED'):
                self.assertNotIn(sensitive, output.read_text()+stdout.getvalue())
            self.assertEqual({p.name for p in root.iterdir()}, {'identity.json', 'report.json'})
            self.assertEqual(len(logout_headers), 1)
            self.assertTrue(report['logoutPassed'])
            return report, logout_headers[0]

    def test_normal_refresh_is_followed_by_local_logout_without_token_files(self):
        report, headers = self.run_fixture(200)
        self.assertEqual(len(report['rounds']), 3)
        self.assertTrue(report['refreshIdentityVerified'])
        self.assertEqual(headers['authorization'], 'Bearer SYNTHETIC_RENEWED')

    def test_failed_refresh_still_logs_out_original_local_session(self):
        report, headers = self.run_fixture(401)
        self.assertEqual(report['error'], 'NORMAL_AUTH_REFRESH_FAILED')
        self.assertEqual(len(report['rounds']), 1)
        self.assertEqual(headers['authorization'], 'Bearer SYNTHETIC_ACCESS')

    def test_interruption_still_logs_out_without_persisting_credentials(self):
        report, headers = self.run_fixture(200, interrupted=True)
        self.assertEqual(report['error'], 'QA_INTERRUPTED')
        self.assertEqual(len(report['rounds']), 0)
        self.assertEqual(headers['authorization'], 'Bearer SYNTHETIC_ACCESS')


if __name__ == '__main__':
    unittest.main()
