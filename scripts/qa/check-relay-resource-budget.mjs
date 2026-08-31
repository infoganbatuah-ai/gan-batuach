import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";

const server = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const start = server.slice(server.indexOf("async function startRelay("));
const argsCode = start.slice(start.indexOf("  const args = ["), start.indexOf("  const relaySource ="));
assert.ok(argsCode.includes("-hls_flags"));
const fixture = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=160x96:rate=25", "-frames:v", "55", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-g", "25", "-f", "mp4", "-movflags", "frag_keyframe+empty_moov", "pipe:1"], { timeout: 15000, maxBuffer: 2_000_000 });
assert.equal(fixture.status, 0, "Synthetic fixture creation must succeed");
const root = mkdtempSync(join(tmpdir(), "relay-budget-qa-"));
try {
  for (const copyVideo of [true, false]) {
    const directory = mkdtempSync(join(root, "mode-")), playlist = join(directory, "index.m3u8");
    const args = vm.runInNewContext(`${argsCode}\nargs`, { copyVideo, directory, playlist, process: { env: {} }, join });
    const input = args.indexOf("-i"), codec = args.indexOf("-c:v");
    assert.equal(args[args.indexOf("-threads") + 1], "1");
    assert.ok(args.indexOf("-threads") < input, "Decoder budget must precede input");
    assert.equal(args[args.indexOf("-filter_threads") + 1], "1");
    assert.equal(args[codec + 1], copyVideo ? "copy" : "libx264");
    if (!copyVideo) assert.equal(args[args.indexOf("-threads", input) + 1], "2");
    assert.ok(!args.includes("-r") && !args.includes("-re"), "Do not rewrite media timing or pace live input artificially");
    const result = spawnSync("ffmpeg", args, { input: fixture.stdout, timeout: 15000, maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, `Actual ${copyVideo ? "copy" : "transcode"} relay arguments must work`);
    assert.match(readFileSync(playlist, "utf8"), /#EXTINF:/);
  }
} finally { rmSync(root, { recursive: true, force: true }); }
console.log("PASS: actual relay args bound decoder/filter/encoder threads; copy and transcode emit HLS from synthetic media without timestamp rewriting");
