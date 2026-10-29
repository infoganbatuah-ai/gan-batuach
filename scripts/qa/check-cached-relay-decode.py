"""Read already-produced local HLS only; no HTTP, camera, credentials or media export."""
import argparse, hashlib, json, os, pathlib, re, stat, subprocess, tempfile, time
MAX_BYTES = 8 * 1024 * 1024
STREAM = re.compile(r'^dvr_[a-f0-9]{18}_(\d+)(?:-[0-9a-f-]{36})?$')
SEGMENT = re.compile(r'^segment-\d+\.ts$')

def read_bounded(path, maximum):
    # All parents are checked as well: O_NOFOLLOW alone protects only the leaf.
    for parent in [path, *path.parents]:
        if parent.is_symlink():
            raise ValueError('SYMLINK_REJECTED')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as f:
        before = os.fstat(f.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_size > maximum:
            raise ValueError('FILE_TYPE_OR_SIZE_REJECTED')
        data = f.read(maximum + 1)
        after = os.fstat(f.fileno())
        if len(data) > maximum or (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
            raise ValueError('FILE_CHANGED_DURING_READ')
        return data, before

def candidates(root):
    result = {}
    for playlist in list(root.glob('*/index.m3u8')) + list(root.glob('.generations/*/index.m3u8')):
        match = STREAM.fullmatch(playlist.parent.name)
        if not match:
            continue
        try:
            data, info = read_bounded(playlist, 32768)
            lines = data.decode('ascii').splitlines()
            names = [x for x in lines if x and not x.startswith('#')]
            if not names or any(not SEGMENT.fullmatch(x) for x in names):
                continue
            segment = playlist.parent / names[-1]
            content, seginfo = read_bounded(segment, MAX_BYTES)
            channel = int(match[1])
            if channel not in result or info.st_mtime_ns > result[channel]['playlistMtimeNs']:
                result[channel] = {'playlistMtimeNs': info.st_mtime_ns,
                    'segmentMtimeNs': seginfo.st_mtime_ns, 'sequence': int(names[-1][8:-3]),
                    'generationHash': hashlib.sha256(playlist.parent.name.encode()).hexdigest()[:16],
                    'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest(), '_content': content}
        except (OSError, ValueError, UnicodeError):
            continue  # concurrent rollover is unproven, never a success
    return result

def decode(content):
    # Explicit pipe-only protocols. No source address/file can be read by FFmpeg.
    try:
        r = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-threads', '1',
            '-protocol_whitelist', 'pipe', '-f', 'mpegts', '-i', 'pipe:0', '-map', '0:v:0',
            '-an', '-frames:v', '2', '-threads', '1', '-f', 'framemd5', 'pipe:1'],
            input=content, capture_output=True, timeout=8)
        hashes = [l.rsplit(',', 1)[-1].strip() for l in r.stdout.decode(errors='replace').splitlines()
                  if l and not l.startswith('#')]
        hashes = [h for h in hashes if re.fullmatch('[a-f0-9]{32}', h)]
        return {'decodedFrames': len(hashes), 'decodePassed': r.returncode == 0 and len(hashes) == 2,
                'frameHashes': hashes, 'decoderExitCode': r.returncode}
    except subprocess.TimeoutExpired:
        return {'decodedFrames': 0, 'decodePassed': False, 'reason': 'DECODE_TIMEOUT'}

def main():
    p = argparse.ArgumentParser(); p.add_argument('--output', required=True); p.add_argument('--interval', type=int, default=15)
    args = p.parse_args()
    if not 5 <= args.interval <= 30: raise ValueError('INTERVAL_OUT_OF_RANGE')
    ports = {18082: set([1,2,3,4,5,6,7,8,10,11]), 18083: set([1])}
    roots = {port: pathlib.Path(tempfile.gettempdir()).resolve() / f'gan-batuach-video-gateway-hls-{port}' for port in ports}
    # Resolve system /var alias once; children still reject symlinks.
    first = {port: candidates(root) for port, root in roots.items()}
    for rows in first.values():
        for row in rows.values(): row.pop('_content', None)
    time.sleep(args.interval)
    report = {'observedUtc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'scope': 'EXISTING_LOCAL_HLS_ONLY_NOT_PRODUCT_PLAYBACK', 'noNetworkRequests': True, 'ports': {}}
    for port, root in roots.items():
        second = candidates(root); results = []
        for channel in sorted(ports[port]):
            before = first[port].get(channel); after = second.get(channel)
            row = {'channel': channel, 'presentBothSamples': bool(before and after)}
            if after:
                content = after.pop('_content')
                row.update(after); row.update(decode(content))
                row['fresh'] = 0 <= time.time_ns() - after['segmentMtimeNs'] <= 15_000_000_000
                row['changed'] = bool(before and before['sha256'] != after['sha256'])
                row['advanced'] = bool(before and (after['generationHash'] != before['generationHash'] or after['sequence'] > before['sequence']))
            row['pass'] = all(row.get(k) for k in ('presentBothSamples','decodePassed','fresh','changed','advanced'))
            results.append(row)
        report['ports'][port] = {'expected': len(ports[port]), 'passed': sum(r['pass'] for r in results), 'channels': results}
    report['pass'] = all(r['expected'] == r['passed'] for r in report['ports'].values())
    pathlib.Path(args.output).write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'scope': report['scope'], 'pass': report['pass'], 'components': {k: {'expected':v['expected'],'passed':v['passed']} for k,v in report['ports'].items()}}))

if __name__ == '__main__': main()
