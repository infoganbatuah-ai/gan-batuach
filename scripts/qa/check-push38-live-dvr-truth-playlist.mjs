import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("scripts/qa/observe-live-gateway-dvr-truth.mjs", "utf8");

assert.match(source, /playlist\.split\(\/\\r\?\\n\/\)/,
  "the live proof must inspect each HLS playlist line");
assert.match(source, /new URL\(line, url\)\.searchParams\.has\("token"\)/,
  "the live proof must accept a scoped token in any canonical query position");
assert.doesNotMatch(source, /segment-\\d\+\\\.ts\\\?token=/,
  "the live proof must not require token to be the first query parameter");

const playlist = [
  "#EXTM3U",
  "#EXTINF:1.200000,",
  "segment-000183.ts?generation=11111111-1111-4111-8111-111111111111&revision=1&token=grant",
  ""
].join("\n");
const url = "http://127.0.0.1:18082/hls/stream/index.m3u8?token=grant";
const segment = playlist.split(/\r?\n/).map((line) => line.trim()).find((line) => {
  if (!/^segment-\d+\.ts\?/.test(line)) return false;
  try { return new URL(line, url).searchParams.has("token"); } catch { return false; }
});
assert.equal(segment, playlist.split("\n")[2]);

console.log(JSON.stringify({ ok: true, suite: "push38-live-dvr-truth-playlist", tests: 4 }));
