"""Five-minute HLS liveness observation; two decoders; no saved credentials/media.

Reconnect means a fresh normal product grant/claim. No recorder, relay, or
camera restart/command is sent. This is not continuous browser playback.
"""
import concurrent.futures
import datetime
import hashlib
import importlib.util
import json
import pathlib
import re
import subprocess
import time
import urllib.parse

SPEC = importlib.util.spec_from_file_location('memory_probe', pathlib.Path(__file__).with_name('probe-homeqa-memory-media.py'))
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


def update_progress(state, result, now):
    """No URL, bytes, hashes or authentication values enter the result."""
    previous = state.get('digest')
    changed = previous is not None and result['digest'] != previous
    sequence_reset = state.get('sequence') is not None and result['sequence'] < state['sequence']
    forward = state.get('sequence') is not None and result['sequence'] > state['sequence']
    name_changed = state.get('lastName') is not None and result['lastName'] != state['lastName']
    advanced = changed and (forward or name_changed) and not sequence_reset
    if previous is None or advanced or sequence_reset:
        state['lastAdvanceAt'] = now
    gap = max(0, now-state['lastAdvanceAt'])
    state.update(digest=result['digest'], sequence=result['sequence'], lastName=result['lastName'])
    return {'advanced': advanced, 'baseline': previous is None, 'segmentContentChanged': changed,
            'sequenceReset': sequence_reset, 'noAdvanceSeconds': round(gap, 3), 'stalled': gap >= 20}


def sample_source(source, state, authorize, origin):
    result = {'label': source['label'], 'elapsedSeconds': round(time.monotonic()-origin, 3)}
    try:
        if state.get('url') is None:
            result['stage'] = 'authorization'
            assert state['authorizationAttempts'] < 3, 'AUTHORIZATION_RETRY_BUDGET_EXHAUSTED'
            state['authorizationAttempts'] += 1
            claim = authorize(source)
            state['url'] = claim['url']
            result['reconnected'] = True
            result['reconnectReason'] = state.get('reconnectReason', 'initial')
            result['authorizationStatus'] = claim['authorizationStatus']
            result['claimStatus'] = claim['claimStatus']
        url = state['url']
        assert probe.media_allowed(source, url), 'MEDIA_SCOPE_REJECTED'
        result['stage'] = 'playlist'
        status, playlist = probe.call(url, binary=True)
        result['playlistHttpStatus'] = status
        assert status == 200, 'PLAYLIST_FAILED'
        lines = playlist.decode().splitlines()
        sequence = re.search(rb'^#EXT-X-MEDIA-SEQUENCE:(\d+)\s*$', playlist, re.MULTILINE)
        assert sequence, 'PLAYLIST_SEQUENCE_MISSING'
        names = [line for line in lines if line and not line.startswith('#')]
        assert names, 'NO_SEGMENTS'
        segment_url = urllib.parse.urljoin(url, names[-1])
        assert probe.media_allowed(source, segment_url), 'SEGMENT_SCOPE_REJECTED'
        result['stage'] = 'segment'
        status, segment = probe.call(segment_url, binary=True)
        result['segmentHttpStatus'] = status
        assert status == 200 and len(segment) > 1024, 'SEGMENT_FAILED'
        digest = hashlib.sha256(segment).digest()
        result['freshDecodedFrames'] = 0
        if digest != state.get('digest'):
            result['stage'] = 'decode'
            remaining = probe.DEADLINE-time.monotonic()
            assert remaining > 0, 'QA_WINDOW_EXPIRED'
            decoded = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-threads', '1',
                '-protocol_whitelist', 'pipe', '-f', 'mpegts', '-i', 'pipe:0', '-map', '0:v:0',
                '-an', '-frames:v', '2', '-threads', '1', '-f', 'framemd5', 'pipe:1'],
                input=segment, capture_output=True, timeout=min(8, remaining))
            frames = sum(bool(line) and not line.startswith('#')
                         for line in decoded.stdout.decode(errors='replace').splitlines())
            result['freshDecodedFrames'] = frames
            result['decoderExitCode'] = decoded.returncode
            assert decoded.returncode == 0 and frames == 2, 'DECODE_FAILED'
        progress = update_progress(state, {'digest': digest, 'sequence': int(sequence[1]), 'lastName': names[-1]}, time.monotonic())
        result.update(progress, mediaSequence=int(sequence[1]), segmentBytes=len(segment))
        result['stage'] = 'observed'
        if progress['stalled']:
            result['error'] = 'HLS_NOT_ADVANCING_20_SECONDS'
            if state['authorizationAttempts'] < 3:
                state['url'] = None
                state['reconnectReason'] = 'stalled_reclaim'
    except Exception as error:
        message = str(error)
        result['error'] = message if re.fullmatch('[A-Z0-9_]{1,70}', message) else type(error).__name__
        if state['authorizationAttempts'] < 3 and state.get('url') is None:
            state['reconnectReason'] = 'authorization_retry'
    return result


def observe(sources, authorize, refresh_auth, checkpoint):
    started = time.monotonic()
    observation = {'scope': 'HOME_QA_BOUNDED_HLS_SAMPLING', 'plannedSeconds': 300, 'intervalSeconds': 15,
        'maximumDecoders': 2, 'maximumAuthorizationAttemptsPerSource': 3,
        'continuousBrowserPlayback': False, 'cameraCommands': 0,
        'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'records': [],
        'authRefreshes': [], 'completed': False}
    states = {source['label']: {'authorizationAttempts': 0, 'lastAdvanceAt': started} for source in sources}
    refreshed = False
    checkpoint(observation)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for index in range(21):
            if index:
                time.sleep(max(0, min(started+index*15-time.monotonic(), probe.DEADLINE-time.monotonic())))
            assert time.monotonic() < probe.DEADLINE, 'QA_WINDOW_EXPIRED'
            headroom = probe.inspect_disk_headroom()
            assert headroom['activeQualificationAllowed'], 'QA_DISK_HEADROOM_INSUFFICIENT'
            if not refreshed and time.monotonic()-started >= 150:
                event = refresh_auth()
                observation['authRefreshes'].append({'elapsedSeconds': round(time.monotonic()-started, 3), **event})
                for state in states.values():
                    if state['authorizationAttempts'] < 3:
                        state['url'] = None
                        state['reconnectReason'] = 'scheduled_reclaim_after_auth_refresh'
                refreshed = True
            results = list(pool.map(lambda source: sample_source(source, states[source['label']], authorize, started), sources))
            observation['records'].append({'index': index, 'elapsedSeconds': round(time.monotonic()-started, 3),
                                           'diskFreeBytes': headroom['availableBytes'], 'results': results})
            checkpoint(observation)
    observation['observedSeconds'] = round(time.monotonic()-started, 3)
    observation['completed'] = len(observation['records']) == 21 and observation['observedSeconds'] >= 300
    observation['perSource'] = []
    for source in sources:
        rows = [next(result for result in record['results'] if result['label'] == source['label']) for record in observation['records']]
        observation['perSource'].append({'label': source['label'], 'samples': len(rows),
            'advances': sum(row.get('advanced', False) for row in rows),
            'freshDecodedFrames': sum(row.get('freshDecodedFrames', 0) for row in rows),
            'sequenceResets': sum(row.get('sequenceReset', False) for row in rows),
            'errorSamples': sum('error' in row for row in rows),
            'maxObservedNoAdvanceSeconds': max(row.get('noAdvanceSeconds', 0) for row in rows),
            'authorizationAttempts': states[source['label']]['authorizationAttempts'],
            'successfulClaims': sum(row.get('reconnected', False) for row in rows)})
    checkpoint(observation)
    return observation


if __name__ == '__main__':
    probe.OUTPUT = pathlib.Path(__file__).resolve().parents[2]/'docs/incidents/post-space-soak-20261029/active-hls.json'
    report = probe.main(observer=observe)
    print(json.dumps({'completed': report.get('observation', {}).get('completed'),
                      'error': report.get('error'), 'logoutPassed': report.get('logoutPassed')}))
