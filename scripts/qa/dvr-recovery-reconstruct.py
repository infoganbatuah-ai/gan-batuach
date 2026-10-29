"""Recompute exact checkpoint failures; never equate renewal with progress."""
import hashlib,json,pathlib
ROOT=pathlib.Path('docs/incidents')
p=ROOT/'pilot-streams-2026-10-29/recovery-health-evidence.json'
d=json.loads(p.read_text()); expected={1,2,3,4,5,6,7,8,10,11}; rows=[]
for s in d['samples']:
    c=s['components']['gateway']['channels']
    ids=[v['channel'] for v in c]
    if len(ids)!=len(set(ids)) or not set(ids)<=expected: raise ValueError('CHANNEL_INVENTORY_INVALID')
    stalled=sorted(expected-{v['channel'] for v in c if v.get('progressing') is True})
    rows.append(dict(index=s['index'],at=s['at'],missing=sorted(expected-set(ids)),not_progressing=stalled,renewing=sorted(v['channel'] for v in c if v.get('renewing')),pass_all=not stalled))
assert len(rows)==21 and sum(r['pass_all'] for r in rows)==5
out=dict(source_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),samples=rows,passed=5,failed=16,interpretation='Missing relay input is failure, renewing alone is not progression. Checkpoints are health metadata, not decoded playback.')
(ROOT/'dvr-recovery-2026-10-29/reconstructed-21.json').write_text(json.dumps(out,indent=2)+'\n')
print('21 checkpoints reproduced: 5 PASS, 16 FAIL; unique assigned channels verified')
