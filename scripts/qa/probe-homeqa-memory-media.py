"""Bounded HOME_QA media checks with normal Auth; credentials stay in memory.

No runtime changes, camera commands, media files, or saved session tokens.
The repeated two-frame samples are NOT continuous browser playback proof.
"""
import concurrent.futures
import datetime
import hashlib
import json
import os
import pathlib
import re
import signal
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

AUTH = 'http://127.0.0.1:56421'
PRODUCT = 'http://127.0.0.1:3100'
SITE = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'
SECRET = pathlib.Path('/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-remote-client-secret-20261003.json')
WORKDIR = '/Users/danielderi/.codex/worktrees/7763/Gan-Batuach'
OUTPUT = pathlib.Path(__file__).resolve().parents[2] / 'docs/incidents/cloud-qa-gap-20261029/memory-media.json'
DEADLINE = float('inf')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def call(url, body=None, headers=None, binary=False):
    remaining = DEADLINE - time.monotonic()
    assert remaining > 0, 'QA_WINDOW_EXPIRED'
    request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'content-type': 'application/json', **(headers or {})})
    try:
        with OPENER.open(request, timeout=min(10, remaining)) as response:
            raw = response.read(8 * 1024 * 1024 + 1)
            assert len(raw) <= 8 * 1024 * 1024, 'RESPONSE_LIMIT'
            return response.status, raw if binary else json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        return error.code, b'' if binary else {}


def media_allowed(source, url):
    parsed = urllib.parse.urlsplit(url)
    return (parsed.scheme == 'http' and parsed.hostname == '127.0.0.1'
            and parsed.port == source['port'] and not parsed.username and not parsed.password
            and not parsed.fragment
            and bool(re.fullmatch('/hls/' + re.escape(source['stream']) + r'/(index\.m3u8|segment-[0-9]+\.ts)', parsed.path)))


def decode_sample(source, access):
    result = {'label': source['label'], 'passed': False}
    started = time.monotonic()
    try:
        result['stage'] = 'authorize'
        status, body = call(PRODUCT + '/api/digital-observer/dvr-gateway',
                            {'observer_site_id': SITE, 'camera_source_id': source['id'], 'mode': 'live'},
                            {'authorization': 'Bearer ' + access})
        result['authorizationStatus'] = status
        grant = body.get('data', {}).get('playback', {}).get('grant')
        assert status == 200 and grant, 'SOURCE_AUTH_FAILED'
        result['stage'] = 'claim'
        status, claim = call(f"http://127.0.0.1:{source['port']}/playback/claim", {'grant': grant})
        result['claimStatus'] = status
        assert status == 200, 'MEDIA_CLAIM_FAILED'
        url = claim.get('playback', {}).get('hls_url', '')
        assert media_allowed(source, url), 'MEDIA_SCOPE_REJECTED'
        last_names = []
        segment_digests = []
        for sample in range(2):
            if sample:
                time.sleep(max(0, min(8, DEADLINE - time.monotonic())))
            result['stage'] = 'playlist'
            status, playlist = call(url, binary=True)
            assert status == 200, 'PLAYLIST_FAILED'
            names = [line for line in playlist.decode().splitlines() if line and not line.startswith('#')]
            assert names, 'NO_SEGMENTS'
            sequence = re.search(rb'^#EXT-X-MEDIA-SEQUENCE:(\d+)\s*$', playlist, re.MULTILINE)
            result.setdefault('mediaSequence', []).append(int(sequence[1]) if sequence else None)
            segment_url = urllib.parse.urljoin(url, names[-1])
            assert media_allowed(source, segment_url), 'SEGMENT_SCOPE_REJECTED'
            result['stage'] = 'segment'
            status, segment = call(segment_url, binary=True)
            assert status == 200 and len(segment) > 1024, 'SEGMENT_FAILED'
            segment_digests.append(hashlib.sha256(segment).digest())
            result.setdefault('segmentBytes', []).append(len(segment))
            result['stage'] = 'decode'
            decoded = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-threads', '1',
                                      '-protocol_whitelist', 'pipe', '-f', 'mpegts', '-i', 'pipe:0',
                                      '-map', '0:v:0', '-an', '-frames:v', '2', '-threads', '1',
                                      '-f', 'framemd5', 'pipe:1'], input=segment,
                                     capture_output=True, timeout=max(0.001, min(8, DEADLINE - time.monotonic())))
            frames = sum(bool(line) and not line.startswith('#')
                         for line in decoded.stdout.decode(errors='replace').splitlines())
            result.setdefault('decodedFrames', []).append(frames)
            result.setdefault('decodeExitCodes', []).append(decoded.returncode)
            # Fixed diagnostic categories only: never persist ffmpeg stderr,
            # which can contain a private input reference in other callers.
            stderr = decoded.stderr.decode(errors='replace').lower()
            result.setdefault('decodeErrorFlags', []).append({
                key: key in stderr for key in ('invalid', 'corrupt', 'missing', 'error', 'no frame', 'end of file')})
            assert decoded.returncode == 0 and frames == 2, 'DECODE_FAILED'
            last_names.append(names[-1])
        result['playlistAdvanced'] = last_names[0] != last_names[1]
        result['segmentContentChanged'] = segment_digests[0] != segment_digests[1]
        result['passed'] = result['playlistAdvanced']
        if not result['passed']:
            result['error'] = 'PLAYLIST_NOT_ADVANCING'
    except Exception as error:
        message = str(error)
        result['error'] = message if re.fullmatch('[A-Z0-9_]{1,70}', message) else type(error).__name__
    result['elapsedSeconds'] = round(time.monotonic() - started, 3)
    return result


def main():
    global DEADLINE
    assert not OUTPUT.exists(), 'EVIDENCE_ALREADY_EXISTS'
    report = {'scope': 'HOME_QA_MEMORY_ONLY_AUTH_REPEATED_MEDIA_SAMPLES',
              'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'continuousPlayback': False, 'browserPlayback': False,
              'credentialsPersisted': False, 'rounds': [], 'logoutPassed': None}
    access = None
    key = None
    start = time.monotonic()
    DEADLINE = start + 420
    def interrupt(_signum, _frame):
        raise RuntimeError('QA_INTERRUPTED')
    previous_handlers = {s: signal.signal(s, interrupt) for s in (signal.SIGINT, signal.SIGTERM)}
    try:
        label = subprocess.check_output(['docker', '--context', 'colima-push38t', 'inspect', '--format',
                                         '{{ index .Config.Labels "com.supabase.cli.project" }}',
                                         'supabase_db_gan-batuach-push38t'], text=True, stderr=subprocess.DEVNULL, timeout=10).strip()
        assert label == 'gan-batuach-push38t', 'QA_DATABASE_SCOPE_REJECTED'
        assert SECRET.is_file() and not SECRET.is_symlink() and SECRET.stat().st_mode & 0o077 == 0
        identity = json.loads(SECRET.read_text())
        assert identity['protocol'] == 'observer-push38-remote-client-secret-v1'
        # Supabase CLI uses DOCKER_HOST, independently of the context used by
        # the explicit docker command above. Pin both to this isolated stack.
        context = json.loads(subprocess.check_output(['docker', 'context', 'inspect', 'colima-push38t'],
                                                    text=True, stderr=subprocess.DEVNULL, timeout=10))[0]
        socket = 'unix://' + str(pathlib.Path.home() / '.colima/push38t/docker.sock')
        assert context['Endpoints']['docker']['Host'] == socket, 'QA_DOCKER_HOST_REJECTED'
        cli_env = {**os.environ, 'DOCKER_HOST': socket, 'DOCKER_CONTEXT': 'colima-push38t'}
        raw = subprocess.check_output(['supabase', 'status', '--workdir', WORKDIR, '--output', 'env'],
                                      text=True, stderr=subprocess.DEVNULL, timeout=20, env=cli_env)
        variables = {}
        for line in raw.splitlines():
            name, separator, value = line.partition('=')
            if separator and name in ('API_URL', 'PUBLISHABLE_KEY', 'ANON_KEY'):
                variables[name] = json.loads(value) if value.startswith('"') else value
        assert variables['API_URL'] == AUTH, 'QA_AUTH_SCOPE_REJECTED'
        key = variables.get('PUBLISHABLE_KEY') or variables.get('ANON_KEY')
        assert key, 'QA_AUTH_KEY_MISSING'
        headers = {'apikey': key}
        status, session = call(AUTH + '/auth/v1/token?grant_type=password',
                               {'email': identity['email'], 'password': identity['password']}, headers)
        assert status == 200, 'NORMAL_LOGIN_FAILED'
        access = session.get('access_token')
        assert access and session['user']['id'] == identity['user_id'], 'PILOT_IDENTITY_MISMATCH'
        status, user = call(AUTH + '/auth/v1/user', headers={**headers, 'authorization': 'Bearer ' + access})
        assert status == 200 and user['id'] == identity['user_id'], 'PILOT_IDENTITY_NOT_VERIFIED'
        report['normalLoginVerified'] = True
        status, rows = call(AUTH + '/rest/v1/digital_observer_camera_sources?select=id,connector_type,metadata&observer_site_id=eq.' + SITE,
                            headers={**headers, 'authorization': 'Bearer ' + access})
        assert status == 200 and len(rows) == 17, 'SOURCE_INVENTORY_MISMATCH'
        sources = []
        for row in rows:
            metadata = row['metadata']
            if metadata.get('channel_assignment') != 'ASSIGNED':
                continue
            tapo = row['connector_type'] == 'rtsp'
            expected_gateway = 'db267b52-6282-4944-bcee-5d4857698fb0' if tapo else '62df97e2-3c0b-427f-9108-bde029bc10e7'
            assert metadata.get('gateway_id') == expected_gateway, 'GATEWAY_BINDING_MISMATCH'
            channel = int(metadata.get('dvr_channel') or 1)
            stream = metadata['gateway_stream_id']
            assert re.fullmatch(r'dvr_[a-f0-9]{18}_\d+', stream), 'STREAM_BINDING_MISMATCH'
            sources.append({'id': row['id'], 'port': 18083 if tapo else 18082, 'stream': stream,
                            'label': 'Tapo' if tapo else 'DVR CH' + str(channel)})
        assert len(sources) == 11 and len({s['id'] for s in sources}) == 11, 'ASSIGNED_INVENTORY_MISMATCH'
        assert sorted(s['label'] for s in sources) == sorted(['DVR CH' + str(c) for c in (1,2,3,4,5,6,7,8,10,11)] + ['Tapo']), 'CHANNEL_SCOPE_MISMATCH'
        for round_index in range(3):
            assert time.monotonic() < DEADLINE, 'QA_WINDOW_EXPIRED'
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda source: decode_sample(source, access), sources))
            report['rounds'].append({'index': round_index, 'elapsedSeconds': round(time.monotonic()-start, 3), 'results': results})
            OUTPUT.write_text(json.dumps(report, indent=2)+'\n')
            if round_index == 0:
                status, renewed = call(AUTH + '/auth/v1/token?grant_type=refresh_token',
                                       {'refresh_token': session['refresh_token']}, headers)
                report['refreshStatus'] = status
                assert status == 200, 'NORMAL_AUTH_REFRESH_FAILED'
                access = renewed.get('access_token') or access
                assert renewed['user']['id'] == identity['user_id'], 'REFRESH_IDENTITY_MISMATCH'
                report['refreshIdentityVerified'] = True
            if round_index < 2:
                time.sleep(max(0, min(15, DEADLINE - time.monotonic())))
    except Exception as error:
        message = str(error)
        report['error'] = message if re.fullmatch('[A-Z0-9_]{1,70}', message) else type(error).__name__
    finally:
        # Cleanup has its own ten-second request bound even after the probe's
        # total observation budget is exhausted or the user interrupts it.
        DEADLINE = float('inf')
        if access and key:
            try:
                status, _ = call(AUTH + '/auth/v1/logout?scope=local', {}, {'apikey': key, 'authorization': 'Bearer '+access})
                report['logoutPassed'] = status in (200, 204)
            except Exception:
                report['logoutPassed'] = False
        report['observedSeconds'] = round(time.monotonic()-start, 3)
        report['completedUtc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        OUTPUT.write_text(json.dumps(report, indent=2)+'\n')
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)
    print(json.dumps({'rounds': len(report['rounds']), 'passedPerRound': [sum(r['passed'] for r in batch['results']) for batch in report['rounds']],
                      'error': report.get('error'), 'logoutPassed': report['logoutPassed']}))


if __name__ == '__main__':
    main()
