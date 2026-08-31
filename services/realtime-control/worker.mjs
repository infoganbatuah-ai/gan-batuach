// Provisioning endpoint only. Media/signaling stay closed until source-scoped
// authorization and a real publisher/subscriber capability test are installed.
export default {
  async fetch(request, env) {
    const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return Response.json({
        ok: true,
        service: "observer-realtime-control",
        version: 1,
        sfu_configured: Boolean(env.CF_RTC_APP_ID && env.CF_RTC_APP_SECRET),
        signaling_enabled: false,
        live_verified: false,
        records_media: false
      }, { headers });
    }
    return Response.json({ error: "realtime_signaling_not_enabled" }, { status: 503, headers });
  }
};
