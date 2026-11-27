import { pathToFileURL } from "node:url";
import { DigitalObserverServerClient } from "../../packages/digital-observer-sdk/src/index.ts";

const version = "2026-10-19.v1";
const route = "/api/digital-observer/external/v1";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const runRef = /^p43-[a-z0-9]{8,32}$/;

function validate(config) {
  const origin = new URL(config.approvedOrigin);
  const base = new URL(config.baseUrl);
  if (origin.protocol !== "https:" || origin.origin !== config.approvedOrigin || base.href !== `${origin.origin}${route}`) {
    throw new Error("EXACT_APPROVED_SANDBOX_REQUIRED");
  }
  if (!runRef.test(config.runRef ?? "") || !/^[a-f0-9]{40}$/.test(config.sdkRevision ?? "")) {
    throw new Error("RUN_REFERENCE_AND_REVISION_REQUIRED");
  }
  const ids = [config.allowedSite, config.deniedSite, config.firstCamera, config.secondCamera];
  if (!ids.every((id) => uuid.test(id ?? "")) || new Set(ids).size !== ids.length ||
    !/^dosvc_[A-Za-z0-9_-]{26,200}$/.test(config.credential ?? "")) {
    throw new Error("APPROVED_SYNTHETIC_FIXTURE_REQUIRED");
  }
  return base.href;
}

function matchesPage(page, sourceId, siteId) {
  return page?.api_version === version && page?.pagination?.limit === 1 && Array.isArray(page.data) &&
    page.data.length === 1 && page.data[0]?.id === sourceId && page.data[0]?.observer_site_id === siteId;
}

export async function runSignedConformance(config, send = globalThis.fetch.bind(globalThis)) {
  const baseUrl = validate(config);
  const sdk = new DigitalObserverServerClient({
    baseUrl,
    credential: config.credential,
    fetch: async (url, init) => {
      if (url.origin !== config.approvedOrigin || url.pathname !== `${route}/cameras` || init.method !== "GET") {
        throw new Error("UNEXPECTED_REQUEST");
      }
      return send(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8_000) });
    },
  });
  const checks = {
    signed_paging: "NOT_RUN", cross_site_denial: "NOT_RUN", browser_embed: "NOT_RUN",
    browser_revocation: "NOT_RUN", site_transfer: "NOT_RUN", usage_attribution: "NOT_RUN",
  };
  const receipt = {
    schema: "do-partner-conformance-v1", run_ref: config.runRef, evidence: "PARTNER_RUN_CANDIDATE",
    sdk_revision: config.sdkRevision, api_version: version, observed_at_utc: new Date().toISOString(), checks,
  };
  try {
    const query = new URLSearchParams({ site_id: config.allowedSite, limit: "1" });
    const first = await sdk.request(`/cameras?${query}`);
    const cursor = first?.pagination?.next_cursor;
    if (!matchesPage(first, config.firstCamera, config.allowedSite) || typeof cursor !== "string" || !cursor || cursor.length > 500) {
      checks.signed_paging = "FAIL";
      return receipt;
    }
    query.set("cursor", cursor);
    const second = await sdk.request(`/cameras?${query}`);
    if (!matchesPage(second, config.secondCamera, config.allowedSite) || second.pagination.next_cursor !== null) {
      checks.signed_paging = "FAIL";
      return receipt;
    }
    checks.signed_paging = "PASS";
  } catch {
    checks.signed_paging = "FAIL";
    return receipt;
  }
  try {
    await sdk.cameras(config.deniedSite);
    checks.cross_site_denial = "FAIL";
  } catch (error) {
    checks.cross_site_denial = error?.status === 403 && error?.payload?.error?.code === "EXTERNAL_API_SITE_SCOPE_DENIED" &&
      error.payload.data === undefined ? "PASS" : "FAIL";
  }
  return receipt;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== "--run-approved-sandbox") {
    process.stderr.write("No requests sent. Use --run-approved-sandbox only with a verified approval record.\n");
    process.exitCode = 2;
  } else {
    const env = process.env;
    try {
      const receipt = await runSignedConformance({
        approvedOrigin: env.PARTNER_APPROVED_API_ORIGIN, baseUrl: env.PARTNER_EXTERNAL_V1_URL,
        runRef: env.PARTNER_RUN_REF, sdkRevision: env.PARTNER_SDK_REVISION, credential: env.PARTNER_SERVICE_CREDENTIAL,
        allowedSite: env.PARTNER_ALLOWED_SITE, deniedSite: env.PARTNER_DENIED_SITE,
        firstCamera: env.PARTNER_FIRST_SOURCE, secondCamera: env.PARTNER_SECOND_SOURCE,
      });
      process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
      if (Object.values(receipt.checks).includes("FAIL")) process.exitCode = 1;
    } catch {
      process.stderr.write("Approved sandbox configuration invalid. No result recorded.\n");
      process.exitCode = 2;
    }
  }
}
