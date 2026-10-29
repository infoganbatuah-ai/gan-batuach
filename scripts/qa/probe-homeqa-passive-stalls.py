"""Ninety-second observation only. No Auth, media demand, or runtime changes."""
import datetime
import json
import pathlib
import time
import urllib.request

OUT = pathlib.Path(__file__).resolve().parents[2] / 'docs/incidents/deployment-hls-replay-20261029/passive-stalls.json'
FIELDS = ('channel', 'progressing', 'renewing', 'owner_state', 'native_input_ended', 'age_ms',
          'relay_age_ms', 'input_idle_ms', 'output_idle_ms', 'bytes', 'chunks')
COUNTERS = ('starts', 'upstreamEnded', 'inputSocketError', 'warmHandoffs',
            'warmHandoffFailures', 'silentResponseRescues', 'exclusiveRescueReopens')


def main():
    assert not OUT.exists(), 'EVIDENCE_ALREADY_EXISTS'
    started = time.monotonic()
    report = {'scope': 'HOME_QA_PASSIVE_ONLY_NOT_ACTIVE_QUALIFICATION',
              'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'plannedSeconds': 90, 'intervalSeconds': 6, 'samples': []}
    for index in range(16):
        if index:
            time.sleep(max(0, started + index * 6 - time.monotonic()))
        sample = {'elapsedSeconds': round(time.monotonic()-started, 3), 'gateways': []}
        for port in (18082, 18083):
            gateway = {'port': port}
            try:
                assert time.monotonic()-started < 100, 'OBSERVATION_BUDGET_EXPIRED'
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=3) as response:
                    raw = response.read(2 * 1024 * 1024 + 1)
                assert len(raw) <= 2 * 1024 * 1024, 'HEALTH_RESPONSE_LIMIT'
                data = json.loads(raw)
                media = data.get('mediaHeartbeat', {})
                gateway.update(status=data.get('status'),
                               heartbeatConsecutiveFailures=data.get('recorderSessionHeartbeat', {}).get('consecutive_failures'),
                               lifecycle={k: media.get('lifecycle', {}).get(k) for k in COUNTERS}, inputs=[])
                for item in media.get('inputs', []):
                    safe = {k: item.get(k) for k in FIELDS}
                    safe['encoder'] = item.get('encoder') if item.get('encoder') in ('libx264', 'videotoolbox', 'copy') else 'UNKNOWN'
                    gateway['inputs'].append(safe)
            except Exception as error:
                gateway['errorClass'] = type(error).__name__
            sample['gateways'].append(gateway)
        report['samples'].append(sample)
        report['observedSeconds'] = round(time.monotonic()-started, 3)
        report['completed'] = index == 15
        OUT.write_text(json.dumps(report, indent=2)+'\n')
        if time.monotonic()-started >= 100:
            break
    print(json.dumps({'completed': report['completed'], 'seconds': report['observedSeconds'], 'samples': len(report['samples'])}))


if __name__ == '__main__':
    main()
