"""Public-input/native-config probe only. Never instantiates or starts a VM."""
import hashlib, json, os, pathlib, shutil, stat, subprocess, tempfile, time
source = pathlib.Path('/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.qa-offline-vz-zbBWgKws')
expected = {
 'ubuntu-24.04-server-cloudimg-arm64.img': '50e24e1fb79e89116e939d90aa7738f7af48c442fa1bc2510131e0b39c50348e',
 'supabase-postgres-arm64-docker-save.tar': '51c3b993f6ec02b579665fcd56c4f126107dd474e97f6fcf723e66c703c30e27',
 'ubuntu-qa-boot.raw': '70c4b0a60310b3a995a359b2a85258590608057f90b81567bbe27ac650aa00f4',
 'offline-qa-inputs.iso': 'c3bc6ba91070169e485df78b3e2ec56f581eafcc007f31888f58a7297d193edb'}
def measure(path):
 fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
 with os.fdopen(fd, 'rb') as f:
  s = os.fstat(f.fileno()); assert stat.S_ISREG(s.st_mode)
  h = hashlib.file_digest(f, 'sha256').hexdigest()
  after = os.fstat(f.fileno())
  assert (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns) == (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
  return {'bytes': s.st_size, 'allocatedBytes': s.st_blocks * 512, 'sha256': h}
r = {'startedUtc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'inputs': {}, 'vmCreated': False, 'ownerKeyAccessed': False}
scratch = None
try:
 for name, digest in expected.items():
  m = measure(source/name); assert m['sha256'] == digest
  r['inputs'][name] = m
 r['freeBytesBefore'] = shutil.disk_usage('/private/tmp').free
 assert r['freeBytesBefore'] > 6 * 1024**3
 scratch = pathlib.Path(tempfile.mkdtemp(prefix='do-qa-native-', dir='/private/tmp'))
 raw = scratch/'boot.raw'
 shutil.copyfile(source/'ubuntu-qa-boot.raw', raw); raw.chmod(0o600)
 r['scratchRaw'] = measure(raw)
 assert r['scratchRaw']['sha256'] == expected['ubuntu-qa-boot.raw']
 result = subprocess.run(['/private/tmp/do-qa-native-preflight', str(raw), str(source/'offline-qa-inputs.iso')], capture_output=True, text=True, timeout=30)
 r['native'] = {'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
 r['inputIsoAfter'] = measure(source/'offline-qa-inputs.iso')
 assert r['inputIsoAfter']['sha256'] == expected['offline-qa-inputs.iso']
finally:
 if scratch:
  shutil.rmtree(scratch)
  r['scratchRemoved'] = not scratch.exists()
 r['freeBytesAfter'] = shutil.disk_usage('/private/tmp').free
 r['finishedUtc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
 pathlib.Path('docs/qualification/isolated-20261029/measurement.json').write_text(json.dumps(r, indent=2)+'\n')
 print(json.dumps(r, indent=2))
