"""Read-only bounded health capture. Stores explicit non-secret fields only."""
import datetime, json, pathlib, ssl, subprocess, urllib.request, urllib.error, os, time
OUT = pathlib.Path('docs/incidents/dvr-recovery-2026-10-29')
APP = pathlib.Path.home() / 'Library/Application Support/Digital Observer'
def pick(x, keys):
    return {k:x[k] for k in keys.split() if k in x}
def health(port):
    try: return healthy(port)
    except Exception as e: return {"reachable":False,"error_type":type(e).__name__,"errno":getattr(getattr(e,"reason",None),"errno",None)}
def healthy(port):
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=8) as r:
        d=json.load(r)
    m=d.get('mediaHeartbeat',{})
    return dict(status=d.get('status'), read_only=d.get('read_only'), reasons=d.get('health_reason_codes'),
      runtime=pick(d.get('edgeRuntime',{}),'software_version build_sha'), authorization=d.get('deviceAuthorization',{}).get('status'),
      discovery=d.get('lastDiscovery'), media=pick(m,'activeRelays canonicalRelays liveRelayProcesses progressingRelays renewingRelays availableRelays stalledRelays'),
      channels=[pick(c,'channel progressing renewing owner_state native_input_ended input_codec output_idle_ms') for c in m.get('inputs',[])],
      diagnostics=[pick(c,'channel starts exits last_start_reason last_failure_reason last_exit_code last_runtime_ms last_handoff_mode last_handoff_result last_handoff_failure last_handoff_first_output_latency_ms hardware_output_stalled_input_idle_ms hardware_output_stalled_output_idle_ms silent_response_input_idle_ms silent_response_output_idle_ms retry_failures correlated_silent_response_sources') for c in m.get('source_diagnostics',[])],
      heartbeat=pick(d.get('recorderSessionHeartbeat',{}),'attempts responses_ok failures consecutive_failures authentication_rejected'),
      lifecycle=pick(d.get('recorderSessionLifecycle',{}),'login_attempts login_succeeded active_sessions rotations last_rotation_reason'),
      hardware=pick(d.get('hardwareTranscoding',{}),'available reason software_fallback_channels'))
def main():
    import plistlib, hashlib
    result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'existing local health only; no playback or camera commands','samples':[], 'services':[]}
    for p in sorted(pathlib.Path.home().joinpath('Library/LaunchAgents').glob('*ganbatuach*')):
        d=plistlib.loads(p.read_bytes()); label=d.get('Label','')
        q=subprocess.run(['/bin/launchctl','print',f'gui/{os.getuid()}/{label}'],capture_output=True,text=True)
        import re
        state=re.search(r'^\s*state = (.+)$',q.stdout,re.M); pid=re.search(r'^\s*pid = (\d+)$',q.stdout,re.M)
        result['services'].append(dict(label=label,registered=q.returncode==0,state=state.group(1) if state else None,pid=int(pid.group(1)) if pid else None,run_at_load=d.get('RunAtLoad'),keep_alive=d.get('KeepAlive'),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
    for i in range(3):
        result['samples'].append({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'dvr':health(18082),'tapo':health(18083)})
        if i<2: time.sleep(10)
    ca=APP/'observer-gateway/ota/qa-control-plane-ca.crt'
    ctx=ssl.create_default_context(cafile=str(ca))
    try:
        urllib.request.urlopen('https://127.0.0.1:3101/api/video-gateway/event-manifest',context=ctx,timeout=8)
        result['tls_anonymous_status']=200
    except urllib.error.HTTPError as e: result['tls_anonymous_status']=e.code
    except Exception as e: result['tls_anonymous_status']=type(e).__name__
    result['tls_leaf']=pick(ssl._ssl._test_decode_cert(str(ca)),'notBefore notAfter')
    (OUT/'live-health.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'samples':len(result['samples']),'tls_status':result['tls_anonymous_status'],'services':len(result['services'])}))
if __name__=='__main__':main()
