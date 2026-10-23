import { timingSafeEqual } from "node:crypto";
import { createCh1CookieCustody } from "./push44-ch1-cookie-custody.mjs";
import { createCh1DevelopmentAuthenticator } from "./push44-ch1-development-session.mjs";
import { SYNTHETIC_QA } from "./push44-ch1-private-media.mjs";
import { issueGatewayPlaybackGrant } from "../../lib/domain/gateway-device-enrollment.ts";

export const SYNTHETIC_EDGE_ORIGIN = "https://do-p44-synthetic-qa-20261023.info-ganbatuah.workers.dev";

// Host-memory-only transport. No Keychain export, public localhost callback,
// inbound tunnel, credential file creation, arbitrary URL or camera adapter.
// The trusted operator supplies a FRESH Development token and verified phone
// binding; this constructor alone neither logs in nor opens external access.
export function createSyntheticQaControl({ origin, controlKey, grantSecret, bindCode,
  accessToken, expectedRuntimeSha, sessionId, deviceId, fetcher = fetch, now = Date.now } = {}) {
  if (origin !== SYNTHETIC_EDGE_ORIGIN || !/^[A-Za-z0-9_-]{43,96}$/.test(controlKey || "") ||
    !/^[A-Za-z0-9_-]{43,96}$/.test(grantSecret || "") || !/^[A-Za-z0-9_-]{43}$/.test(bindCode || "") ||
    typeof accessToken !== "string" || accessToken.length < 32 || !sessionId || !deviceId)
    throw new Error("SYNTHETIC_CONTROL_INPUT_DENIED");
  let stopped = false, calls = 0;
  const startedAt = now();
  const approved = { sessionId, deviceId, revoked: false };
  const verify = createCh1DevelopmentAuthenticator({ expectedRuntimeSha,
    readSessionToken: async () => accessToken, readApprovedSession: async () => approved, fetcher });
  const custody = createCh1CookieCustody({ verifySession: token => token === accessToken ? verify({}) : null, now });
  const call = async (path, body) => {
    if (++calls > 5000 || now() - startedAt >= 300_000) throw new Error("CONTROL_LIMIT");
    const response = await fetcher(`${origin}/control/${path}`, {
      method: body === undefined ? "GET" : "POST", redirect: "error", cache: "no-store",
      headers: { authorization: `Bearer ${controlKey}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) throw new Error("CONTROL_EDGE_DENIED");
    const text = await response.text(); if (text.length > 64 * 1024) throw new Error("CONTROL_RESPONSE_TOO_LARGE");
    return text;
  };
  function grant() {
    const token = issueGatewayPlaybackGrant({ gateway_id: SYNTHETIC_QA.gatewayId, observer_site_id: SYNTHETIC_QA.siteId,
      camera_source_id: SYNTHETIC_QA.sourceId, gateway_stream_id: SYNTHETIC_QA.streamId }, grantSecret);
    const claims = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    return { grant: token, grantExpires: claims.exp };
  }
  return Object.freeze({
    async step() {
      if (stopped) throw new Error("CONTROL_CLOSED");
      try {
        const jobs = JSON.parse(await call("poll"));
        if (!Array.isArray(jobs) || jobs.length > 8) throw new Error("CONTROL_JOBS_DENIED");
        for (const job of jobs) {
          if (!/^\d{1,5}$/.test(job?.id || "") || !["bind", "authenticate"].includes(job.type))
            throw new Error("CONTROL_JOB_DENIED");
          let result = {};
          if (job.type === "bind" && typeof job.code === "string" && job.code.length === bindCode.length &&
            timingSafeEqual(Buffer.from(job.code), Buffer.from(bindCode))) {
            const cookie = (await custody.bind(accessToken)).split(";")[0];
            const principal = await custody.authenticate({ headers: { cookie } });
            if (principal) result = { cookie, principal, ...grant() };
          } else if (job.type === "authenticate" && typeof job.cookie === "string") {
            const principal = await custody.authenticate({ headers: { cookie: job.cookie } });
            if (principal) result = { principal, ...grant() };
          }
          await call("respond", { id: job.id, result });
        }
        return { jobs: jobs.length, calls };
      } catch {
        stopped = true; approved.revoked = true; custody.revoke();
        throw new Error("SYNTHETIC_CONTROL_FAILED_CLOSED");
      }
    },
    async stop() {
      approved.revoked = true; custody.revoke(); stopped = true;
      try { await call("revoke", {}); } catch { /* Edge expiry still denies access; cleanup must verify deployment removal. */ }
      return { stopped: true, calls };
    }
  });
}
