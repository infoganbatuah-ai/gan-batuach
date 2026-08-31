import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { createPlaybackSessionClient } from "../../lib/domain/digital-observer/playback-session.ts";

const gateway = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
let headerTimer;
let headerSignal;
let nextResponse = null;
const openSource = runInNewContext(`${gateway.slice(gateway.indexOf("async function privateNvrStreamResponse("), gateway.indexOf("async function pipeWebStreamToWritable("))}; privateNvrStreamResponse`, {
  AbortController, AbortSignal, PROBE_TIMEOUT_MS: 3500,
  setTimeout: (fn) => { headerTimer = fn; return 1; }, clearTimeout: () => { headerTimer = null; },
  fetch: (_url, init) => {
    headerSignal = init.signal;
    return nextResponse ? Promise.resolve(nextResponse) : new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true }));
  }
});
const stalledOpen = openSource("http://synthetic.invalid", "synthetic", "", new AbortController().signal);
headerTimer();
assert.equal(await stalledOpen, null, "A stalled channel must release its relay-start promise");
assert.equal(headerSignal.aborted, true);
nextResponse = new Response("synthetic-media", { headers: { "content-type": "video/mp4" } });
const parent = new AbortController();
assert.equal(await openSource("http://synthetic.invalid", "synthetic", "", parent.signal), nextResponse);
assert.equal(headerTimer, null);
assert.equal(headerSignal.aborted, false, "The header deadline must not terminate healthy streaming bodies");
parent.abort();
assert.equal(headerSignal.aborted, true, "Stopping a relay still cancels its upstream body");
nextResponse = new Response("{}", { headers: { "content-type": "application/json" } });
assert.equal(await openSource("http://synthetic.invalid", "synthetic", "", new AbortController().signal), null);
assert.equal(headerSignal.aborted, true, "Invalid upstream responses must close their connections");
let now = 1_000_000;
const leases = runInNewContext(`${gateway.slice(gateway.indexOf("function issuePlaybackToken("), gateway.indexOf("async function serveHls("))}
  ({ issuePlaybackToken, validatePlaybackToken, playbackTokens });`, {
  Date: { now: () => now }, randomBytes, playbackTokens: new Map(), PLAYBACK_TOKEN_TTL_MS: 300_000
});
const grantHandler = gateway.slice(gateway.indexOf('if (request.url === "/playback/claim"'), gateway.indexOf('if (!authorized(request))'));
assert.ok(grantHandler.indexOf("await claimCloudPlaybackGrant(grant)") < grantHandler.indexOf("issuePlaybackToken(streamId, previousToken)"));
const token = leases.issuePlaybackToken("one");
now += 180_000;
assert.equal(leases.issuePlaybackToken("one", token), token, "Reauthorization preserves the decoder URL");
now += 121_000;
assert.equal(leases.validatePlaybackToken(token, "one"), true, "The renewed lease survives its original deadline");
assert.notEqual(leases.issuePlaybackToken("two", token), token, "A grant for another source cannot extend this lease");
now += 180_000;
assert.equal(leases.validatePlaybackToken(token, "one"), false, "Without further reauthorization a lease still expires");
assert.notEqual(leases.issuePlaybackToken("one", token), token, "Expired tokens are never revived");
assert.equal(leases.playbackTokens.has(token), false, "Expired leases are pruned");

const base = "http://127.0.0.1:18082";
const url = `${base}/hls/one/index.m3u8?token=${token}`;
const calls = [];
let denied = false;
const client = createPlaybackSessionClient({ now: () => now, fetcher: async (destination, init) => {
  const body = JSON.parse(init.body);
  calls.push({ destination, body });
  const cloud = destination.startsWith("/api/");
  if (cloud && denied) return new Response("{}", { status: 403 });
  return new Response(JSON.stringify(cloud
    ? { data: { playback: { claim_url: `${base}/playback/claim`, grant: `synthetic-${calls.length}` } } }
    : { playback: { hls_url: url }, expires_in_seconds: 300 }));
} });
assert.equal(await client.request("site", "one"), url);
await client.renew("site", "one", url);
assert.equal(calls.length, 2, "Do not reauthorize on every timer when the lease is fresh");
now += 180_000;
assert.deepEqual(await Promise.all([client.renew("site", "one", url), client.renew("site", "one", url)]), [url, url]);
assert.equal(calls.length, 4, "Concurrent viewers share one fresh grant/claim");
assert.equal(calls[2].body.playback_token, undefined, "Local media tokens never enter cloud requests");
assert.equal(calls[3].body.playback_token, token);
now += 180_000;
denied = true;
await assert.rejects(client.renew("site", "one", url), /cloud_403/);
assert.equal(calls.length, 5, "Revoked access cannot extend a local lease");
denied = false;
await client.renew("site", "one", url.replace(base, "https://other.invalid"));
assert.equal(calls.at(-1).body.playback_token, undefined, "Never forward a token across media origins");

// Exercise real local FFmpeg with generated pixels, never cameras or secrets.
const flagMatch = gateway.match(/"-hls_start_number_source", "([^"]+)"[\s\S]*?"-hls_flags", "([^"]+)"/);
assert.ok(flagMatch);
const directory = mkdtempSync(join(tmpdir(), "observer-hls-sequence-"));
try {
  const sequences = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=10", "-t", "2.2", "-c:v", "libx264", "-g", "10", "-f", "hls", "-hls_time", "1", "-hls_list_size", "5", "-hls_start_number_source", flagMatch[1], "-hls_flags", flagMatch[2], "-hls_segment_filename", join(directory, "segment-%06d.ts"), join(directory, "index.m3u8")], { encoding: "utf8", timeout: 15_000 });
    assert.equal(result.status, 0, "Synthetic FFmpeg muxing must succeed");
    const playlist = readFileSync(join(directory, "index.m3u8"), "utf8");
    const sequence = Number(playlist.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/)?.[1]);
    assert.ok(Number.isSafeInteger(sequence) && sequence > 0);
    assert.match(playlist, /#EXT-X-DISCONTINUITY/);
    for (const segment of playlist.match(/^segment-\d+\.ts$/gm) || []) assert.ok(readFileSync(join(directory, segment)).length > 0);
    sequences.push(sequence);
  }
  assert.ok(sequences[1] > sequences[0] + 3, "A relay restart must never reuse old sequence numbers");
} finally { rmSync(directory, { recursive: true, force: true }); }
console.log("Live lease renewal, revocation/source isolation, cloud boundary and real synthetic HLS restart QA PASS");
