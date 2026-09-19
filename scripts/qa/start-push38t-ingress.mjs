import { createPush38tIngress } from "../../services/video-gateway/push38t-ota-ingress.mjs";

// A managed Cloudflare Tunnel may connect only to this loopback proxy, never
// directly to Next, Supabase, a dashboard or development tooling.
const server = createPush38tIngress();
server.listen(3101, "127.0.0.1", () => console.log(JSON.stringify({
  environment: "PUSH38T_QUALIFICATION", bind: "127.0.0.1:3101",
  surface: "OTA_AUTHORIZATION_ONLY", publicExposure: false
})));
