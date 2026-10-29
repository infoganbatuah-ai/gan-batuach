"""Bounded read-only HOME_QA observation; never saves raw health or credentials."""
import datetime, json, pathlib, time, urllib.request

OUT = pathlib.Path(__file__).parent / 'passive-soak.json'
FIELDS = ('channel', 'progressing', 'renewing', 'owner_state', 'media_owner_state',
          'canonical_owner_progressing', 'candidate_progressing', 'native_input_ended',
          'bytes', 'chunks', 'age_ms', 'input_idle_ms', 'relay_age_ms', 'output_idle_ms')
COUNTS = ('activeRelays', 'canonicalRelays', 'liveRelayProcesses', 'candidateHandoffs',
          'provisionalHandoffs', 'progressingRelays', 'renewingRelays', 'availableRelays', 'stalledRelays')
def numeric_tree(value):
    if isinstance(value, dict):
        return {k: numeric_tree(v) for k, v in value.items()
                if isinstance(v, (dict, int, float, bool))}
    return value if isinstance(value, (int, float, bool)) else None

start = time.monotonic()
result = {'scope': 'HOME_QA_PASSIVE_HEALTH_ONLY', 'intervalSeconds': 30,
          'plannedSeconds': 180, 'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'decodedFramesMeasured': False, 'credentialsReadOrStored': False, 'samples': []}
for index in range(7):
    if index:
        time.sleep(max(0, start + index * 30 - time.monotonic()))
    sample = {'elapsedSeconds': round(time.monotonic()-start, 3), 'gateways': []}
    for port in (18082, 18083):
        item = {'port': port}
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=8) as response:
                data = json.load(response)
            heartbeat = data.get('mediaHeartbeat', {})
            item.update(status=data.get('status'), ok=data.get('ok'),
                        counts={k: heartbeat.get(k) for k in COUNTS},
                        inputs=[{k: v.get(k) for k in FIELDS} for v in heartbeat.get('inputs', [])],
                        lifecycle=numeric_tree(heartbeat.get('lifecycle', {})),
                        recovery=numeric_tree(heartbeat.get('recovery', {})),
                        recorderLifecycle=numeric_tree(data.get('recorderSessionLifecycle', {})),
                        deviceAuthorization=numeric_tree(data.get('deviceAuthorization', {})))
        except Exception as exc:
            item['errorClass'] = type(exc).__name__
        sample['gateways'].append(item)
    result['samples'].append(sample)
    result['observedSeconds'] = round(time.monotonic()-start, 3)
    result['completed'] = index == 6
    OUT.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({'completed': True, 'samples': len(result['samples']), 'seconds': result['observedSeconds']}))
