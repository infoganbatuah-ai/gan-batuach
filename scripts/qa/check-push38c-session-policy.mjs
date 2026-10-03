import assert from "node:assert/strict";
import { reuseMatchingPrivateNvrSession, shouldRefreshPrivateNvrSession } from "../../services/video-gateway/private-nvr-session-policy.mjs";

const input = { username: "qa", password: "fixture-only", stream_quality: "sub" };
assert.equal(reuseMatchingPrivateNvrSession({ input }, input), true,
  "a shared native stream boundary must not force a new recorder login");
assert.equal(reuseMatchingPrivateNvrSession({ input }, { ...input, password: "rotated" }), false);
assert.equal(reuseMatchingPrivateNvrSession({ input }, { ...input, stream_quality: "main" }), false);
assert.equal(reuseMatchingPrivateNvrSession(null, input), false);
for (const reason of ["source_timeout", "host_network_unreachable", "upstream_socket_closed", "source_transport_error", "source_http_error", "source_unavailable"]) {
  assert.equal(shouldRefreshPrivateNvrSession(reason), false, reason);
}
assert.equal(shouldRefreshPrivateNvrSession("authentication_rejected"), true);
console.log("push38c shared DVR session policy: PASS");
