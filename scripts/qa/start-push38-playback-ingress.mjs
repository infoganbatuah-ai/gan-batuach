import { createPlaybackIngress } from "../../services/video-gateway/playback-ingress.mjs";

const profiles = Object.freeze({
  gateway: { origin: "http://127.0.0.1:18082", port: 18092, profile: "PHYSICAL_GATEWAY" },
  connector: { origin: "http://127.0.0.1:18083", port: 18093, profile: "SOFTWARE_CONNECTOR" }
});
const selected = profiles[String(process.env.PUSH38_PLAYBACK_PROFILE || "").toLowerCase()];
if (!selected) throw new Error("PUSH38_PLAYBACK_PROFILE_INVALID");

const server = createPlaybackIngress({ origin: selected.origin });
server.listen(selected.port, "127.0.0.1", () => process.stdout.write(`${JSON.stringify({
  contract: "observer-push38-playback-ingress-v1",
  profile: selected.profile,
  bind: `127.0.0.1:${selected.port}`,
  exposed_routes: ["POST /playback/claim", "GET /hls/{stream}/index.m3u8", "GET /hls/{stream}/segment-{n}.ts"],
  default_deny: true,
  rate_limited: true,
  tls_termination: "REQUIRED_UPSTREAM",
  recurring_cost_introduced: false
})}\n`));
