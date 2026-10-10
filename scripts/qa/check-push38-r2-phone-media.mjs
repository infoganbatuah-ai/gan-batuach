import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertPush38R2MediaCapability, buildPush38HlsSnapshot, parsePush38HlsSnapshot,
  PUSH38_R2_BUCKET, PUSH38_R2_ORIGIN, push38R2MediaPrefix
} from "../../services/video-gateway/push38-r2-phone-media.mjs";

const session = "AbCdEfGhIjKlMnOpQrStUv";
assert.equal(push38R2MediaPrefix(session), `home-qa-media/${session}`);
assert.throws(() => push38R2MediaPrefix("../other"), /SESSION_INVALID/);
const token = "a".repeat(32);
const generation = "11111111-1111-4111-8111-111111111111";
const playlistUrl = `http://127.0.0.1:18082/hls/source/index.m3u8?token=${token}`;
const playlist = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:7\n#EXTINF:4.0,\nsegment-7.ts?generation=${generation}&revision=1&token=${token}\n#EXTINF:4.0,\nsegment-8.ts?generation=${generation}&revision=2&token=${token}\n`;
const parsed = parsePush38HlsSnapshot(playlist, playlistUrl);
assert.equal(parsed.segments.length, 2);
const signed = ["https://media.example/one.ts?sig=1", "https://media.example/two.ts?sig=2"];
const snapshot = buildPush38HlsSnapshot(parsed, signed);
assert.match(snapshot, /#EXT-X-PLAYLIST-TYPE:VOD/);
assert.match(snapshot, /https:\/\/media\.example\/one\.ts\?sig=1/);
assert.match(snapshot, /#EXT-X-ENDLIST/);
assert.throws(() => parsePush38HlsSnapshot(playlist.replace("#EXTM3U", "#EXTM3U\n#EXT-X-KEY:METHOD=AES-128"),
  playlistUrl), /PLAYLIST_UNSUPPORTED/);
assert.throws(() => parsePush38HlsSnapshot(playlist.replace("segment-8.ts", "http://foreign.invalid/segment-8.ts"),
  playlistUrl), /SEGMENT_SCOPE_INVALID/);
const capability = `${PUSH38_R2_ORIGIN}/${PUSH38_R2_BUCKET}/${push38R2MediaPrefix(session)}/dvr-source/index.m3u8?` +
  `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=test&X-Amz-Date=20261008T000000Z&X-Amz-Expires=900&` +
  `X-Amz-SignedHeaders=host&X-Amz-Signature=${"b".repeat(64)}`;
assert.equal(assertPush38R2MediaCapability(capability, session).origin, PUSH38_R2_ORIGIN);
assert.throws(() => assertPush38R2MediaCapability(capability.replace("X-Amz-Expires=900", "X-Amz-Expires=3600"),
  session), /CAPABILITY_INVALID/);
assert.throws(() => assertPush38R2MediaCapability(capability.replace(PUSH38_R2_ORIGIN, "https://other.invalid"),
  session), /CAPABILITY_INVALID/);
const preparation = readFileSync("scripts/qa/prepare-push38-r2-phone-media.mjs", "utf8");
assert.match(preparation, /verifyGatewayPlaybackGrant\(authorized\.data\.playback\.grant/);
assert.match(preparation, /\/camera\/\$\{encodeURIComponent\(grant\.gateway_stream_id\)\}\/playback/);
assert.match(preparation, /"x-video-gateway-secret": mediaSecrets\[source\.k\]/);
assert.doesNotMatch(preparation, /\/playback\/claim`/);
console.log(JSON.stringify({ status: "PASS", private_r2: true, exact_prefix: true,
  short_lived_capability: true, arbitrary_origin_denied: true, unsupported_hls_denied: true,
  product_grant_verified: true, protected_edge_acquisition: true }));
