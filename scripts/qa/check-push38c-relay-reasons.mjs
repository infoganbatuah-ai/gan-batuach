import assert from "node:assert/strict";
import { classifyRelayExit, safeInputCode } from "../../services/video-gateway/relay-failure-reason.mjs";

assert.equal(classifyRelayExit({ stderr: "Error opening input: Network is unreachable", code: 205 }), "HOST_NETWORK_UNREACHABLE");
assert.equal(classifyRelayExit({ stderr: "RTSP 401 Unauthorized", code: 1 }), "SOURCE_AUTH_REJECTED");
assert.equal(classifyRelayExit({ inputErrorCode: "UND_ERR_SOCKET", code: 0 }), "UPSTREAM_UND_ERR_SOCKET");
assert.equal(classifyRelayExit({ code: 0 }), "SOURCE_STREAM_ENDED");
assert.equal(classifyRelayExit({ stopReason: "STALE_INPUT", code: null }), "STALE_INPUT");
assert.equal(safeInputCode({ cause: { code: "ECONNRESET" } }), "ECONNRESET");
assert.equal(safeInputCode({ code: "PRIVATE_DETAIL" }), "OTHER_TRANSPORT_ERROR");
console.log("push38c relay reason classification: PASS");
