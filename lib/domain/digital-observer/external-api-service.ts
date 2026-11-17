/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 42 schema is additive and precedes generated Supabase types. */
import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { hashEnterpriseCredential } from "./enterprise-identity";
import { assertCommercialEntitlement } from "./commercial-billing-service";
import { validateWebhookDestination } from "./webhook-security";
import {
  externalApiPermissionMap, type ExternalApiScope, verifyExternalApiSignature,
  DIGITAL_OBSERVER_EXTERNAL_API_VERSION
} from "./external-api-contract";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { authorizePartnerDelegatedSite } from "./partner-platform-service";

type Admin = ReturnType<typeof createAdminClient>;

export type ExternalApiActor = {
  requestId: string;
  receiptId: string;
  credentialId: string;
  serviceAccountId: string;
  organizationId: string;
  permissions: string[];
  allSites: boolean;
  siteIds: string[];
  idempotentReplay: boolean;
};

function pepper() {
  const value = process.env.DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER;
  if (!value || value.length < 16) throw new Error("EXTERNAL_API_CREDENTIAL_PEPPER_REQUIRED");
  return value;
}

function bearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer dosvc_") ? value.slice(7).trim() : null;
}

async function audit(admin: Admin, actor: ExternalApiActor | null, input: {
  requestId: string; siteId?: string | null; action: string; decision: "allowed" | "denied";
  result: "success" | "failed" | "blocked" | "unknown"; metadata?: Record<string, unknown>;
}) {
  if (!actor) return;
  await (admin as any).from("digital_observer_enterprise_audit_events").insert({
    organization_id: actor.organizationId,
    observer_site_id: input.siteId ?? null,
    service_account_id: actor.serviceAccountId,
    resource_type: "external_api_request",
    resource_id: input.requestId,
    action: input.action,
    authorization_decision: input.decision,
    result_status: input.result,
    correlation_id: input.requestId,
    safe_metadata: input.metadata ?? {}
  });
}

export async function authenticateExternalApiRequest(request: Request, body: string): Promise<{ admin: Admin; actor: ExternalApiActor }> {
  if (!isAdminClientConfigured()) throw new Error("EXTERNAL_API_UNAVAILABLE");
  const credential = bearer(request);
  if (!credential) throw new Error("EXTERNAL_API_AUTH_REQUIRED");
  const url = new URL(request.url);
  const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 200) || null;
  if (request.method !== "GET" && (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey))) {
    throw new Error("EXTERNAL_API_IDEMPOTENCY_REQUIRED");
  }
  const signature = verifyExternalApiSignature({
    method: request.method,
    path: `${url.pathname}${url.search}`,
    timestamp: request.headers.get("x-do-timestamp"),
    nonce: request.headers.get("x-do-nonce"),
    signature: request.headers.get("x-do-signature"),
    body,
    credential
  });
  if (!signature.valid) throw new Error(`EXTERNAL_API_${signature.reason.toUpperCase()}`);

  const admin = createAdminClient();
  const hash = hashEnterpriseCredential(credential, pepper());
  const credentialResult = await (admin as any).from("digital_observer_service_account_credentials")
    .select("id,service_account_id,expires_at,revoked_at")
    .eq("credential_hash", hash).is("revoked_at", null).maybeSingle();
  if (credentialResult.error || !credentialResult.data || new Date(credentialResult.data.expires_at).getTime() <= Date.now()) {
    throw new Error("EXTERNAL_API_CREDENTIAL_INVALID");
  }
  const accountResult = await (admin as any).from("digital_observer_service_accounts")
    .select("id,organization_id,account_status,permissions,all_sites,expires_at,revoked_at")
    .eq("id", credentialResult.data.service_account_id).maybeSingle();
  const account = accountResult.data;
  if (accountResult.error || !account || account.account_status !== "active" || account.revoked_at || new Date(account.expires_at).getTime() <= Date.now()) {
    throw new Error("EXTERNAL_API_SERVICE_ACCOUNT_INACTIVE");
  }
  const sites = account.all_sites ? { data: [], error: null } : await (admin as any).from("digital_observer_service_account_sites")
    .select("observer_site_id").eq("service_account_id", account.id).limit(1000);
  if (sites.error) throw new Error("EXTERNAL_API_SCOPE_UNAVAILABLE");
  const actor: ExternalApiActor = {
    requestId: request.headers.get("x-request-id")?.slice(0, 120) || randomUUID(),
    receiptId: "",
    credentialId: credentialResult.data.id,
    serviceAccountId: account.id,
    organizationId: account.organization_id,
    permissions: Array.isArray(account.permissions) ? account.permissions.map(String) : [],
    allSites: account.all_sites === true,
    siteIds: (sites.data ?? []).map((row: any) => String(row.observer_site_id)),
    idempotentReplay: false
  };

  const nonce = request.headers.get("x-do-nonce")!;
  const receipt = await (admin as any).from("digital_observer_external_api_request_receipts").insert({
    request_id: actor.requestId,
    credential_id: actor.credentialId,
    service_account_id: actor.serviceAccountId,
    request_nonce: nonce,
    method: request.method,
    request_path: `${url.pathname}${url.search}`,
    request_hash: createHash("sha256").update(body).digest("hex"),
    idempotency_key: idempotencyKey,
    result_status: "accepted"
  }).select("id").single();
  if (receipt.error) {
    if (receipt.error.code === "23505" && idempotencyKey) {
      const existing = await (admin as any).from("digital_observer_external_api_request_receipts")
        .select("id,request_nonce,request_hash")
        .eq("service_account_id", actor.serviceAccountId).eq("method", request.method)
        .eq("request_path", `${url.pathname}${url.search}`).eq("idempotency_key", idempotencyKey).maybeSingle();
      const requestHash = createHash("sha256").update(body).digest("hex");
      if (existing.data && existing.data.request_nonce !== nonce && existing.data.request_hash === requestHash) {
        actor.idempotentReplay = true;
        actor.receiptId = existing.data.id;
      }
      else throw new Error(existing.data ? "EXTERNAL_API_IDEMPOTENCY_CONFLICT" : "EXTERNAL_API_REPLAY_DETECTED");
    } else if (receipt.error.code === "23505") throw new Error("EXTERNAL_API_REPLAY_DETECTED");
    else throw new Error("EXTERNAL_API_RECEIPT_FAILED");
  }
  if (!actor.receiptId) actor.receiptId = receipt.data.id;
  await Promise.all([
    (admin as any).from("digital_observer_service_account_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", actor.credentialId),
    (admin as any).from("digital_observer_service_accounts").update({ last_used_at: new Date().toISOString() }).eq("id", actor.serviceAccountId)
  ]);
  return { admin, actor };
}

export async function completeExternalApiReceipt(admin: Admin, actor: ExternalApiActor, input: { status: number; failed?: boolean }) {
  if (actor.idempotentReplay) return;
  const result = await (admin as any).from("digital_observer_external_api_request_receipts").update({
    result_status: input.failed ? "failed" : "completed",
    response_status: input.status
  }).eq("id", actor.receiptId).eq("service_account_id", actor.serviceAccountId);
  if (result.error) throw new Error("EXTERNAL_API_RECEIPT_FINALIZE_FAILED");
}

export async function authorizeExternalApiSite(admin: Admin, actor: ExternalApiActor, input: { siteId: string; scope: ExternalApiScope }) {
  const permission = externalApiPermissionMap[input.scope];
  if (!actor.permissions.includes(permission)) {
    await audit(admin, actor, { requestId: actor.requestId, siteId: input.siteId, action: input.scope, decision: "denied", result: "blocked", metadata: { reason: "permission_denied" } });
    throw new Error("EXTERNAL_API_PERMISSION_DENIED");
  }
  if (!actor.allSites && !actor.siteIds.includes(input.siteId)) throw new Error("EXTERNAL_API_SITE_SCOPE_DENIED");
  const ownSite = await (admin as any).from("observer_sites")
    .select("id,name,owner_profile_id,site_type,garden_id,digital_observer_organization_id,timezone,monitoring_enabled,business_handles_children,vision_privacy_mode,metadata")
    .eq("id", input.siteId).eq("digital_observer_organization_id", actor.organizationId).is("garden_id", null).neq("site_type", "kindergarten").maybeSingle();
  let site = ownSite.data;
  if (!site) {
    const delegated = await authorizePartnerDelegatedSite(admin, { serviceAccountId: actor.serviceAccountId, siteId: input.siteId });
    if (delegated) {
      const delegatedSite = await (admin as any).from("observer_sites")
        .select("id,name,owner_profile_id,site_type,garden_id,digital_observer_organization_id,timezone,monitoring_enabled,business_handles_children,vision_privacy_mode,metadata")
        .eq("id", input.siteId).is("garden_id", null).neq("site_type", "kindergarten").maybeSingle();
      site = delegatedSite.data;
    }
  }
  if (!site) throw new Error("EXTERNAL_API_SITE_SCOPE_DENIED");
  try { await assertCommercialEntitlement(admin as any, { siteId: input.siteId, key: "api_access" }); }
  catch { throw new Error("EXTERNAL_API_ENTITLEMENT_DENIED"); }
  await audit(admin, actor, { requestId: actor.requestId, siteId: input.siteId, action: input.scope, decision: "allowed", result: "success" });
  return site;
}

export async function recordExternalApiUsage(admin: Admin, actor: ExternalApiActor, input: { siteId: string; operation: string; status: number }) {
  const bucket = new Date().toISOString().slice(0, 13) + ":00:00.000Z";
  const result = await (admin as any).rpc("record_digital_observer_external_api_usage", {
    requested_service_account_id: actor.serviceAccountId,
    requested_site_id: input.siteId,
    requested_operation: input.operation,
    requested_bucket_start: bucket,
    requested_success: input.status < 400
  });
  if (result.error) throw new Error("EXTERNAL_API_USAGE_WRITE_FAILED");
}

export async function assertExternalApiRateLimit(admin: Admin, actor: ExternalApiActor, siteId: string) {
  const sinceMinute = new Date(Date.now() - 60_000).toISOString();
  const recent = await (admin as any).from("digital_observer_external_api_request_receipts")
    .select("id", { count: "exact", head: true }).eq("service_account_id", actor.serviceAccountId).gte("created_at", sinceMinute);
  if (recent.error) throw new Error("EXTERNAL_API_RATE_STATE_UNAVAILABLE");
  if ((recent.count ?? 0) > 120) throw new Error("EXTERNAL_API_RATE_LIMITED");
  const site = await (admin as any).from("observer_sites").select("id,digital_observer_organization_id").eq("id", siteId).is("garden_id", null).neq("site_type", "kindergarten").maybeSingle();
  if (!site.data || (site.data.digital_observer_organization_id !== actor.organizationId
    && !(await authorizePartnerDelegatedSite(admin, { serviceAccountId: actor.serviceAccountId, siteId })))) {
    throw new Error("EXTERNAL_API_SITE_SCOPE_DENIED");
  }
}

export async function registerExternalWebhook(admin: Admin, actor: ExternalApiActor, input: {
  siteId: string; displayName: string; destinationUrl: string; allowedEventTypes: string[]; mode: "disabled" | "sandbox"; signingKeyReference: string;
}) {
  await authorizeExternalApiSite(admin, actor, { siteId: input.siteId, scope: "webhooks.write" });
  const allowlist = (process.env.DIGITAL_OBSERVER_EXTERNAL_WEBHOOK_ALLOWED_HOSTS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const destination = validateWebhookDestination(input.destinationUrl, allowlist);
  if (!destination.allowed) throw new Error(`EXTERNAL_WEBHOOK_${destination.reason.toUpperCase()}`);
  const saved = await (admin as any).from("digital_observer_webhook_endpoints").upsert({
    observer_site_id: input.siteId,
    organization_id: actor.organizationId,
    service_account_id: actor.serviceAccountId,
    display_name: input.displayName,
    destination_url: destination.url,
    destination_host: destination.host,
    destination_fingerprint: destination.fingerprint,
    provider_mode: input.mode,
    active: input.mode === "sandbox",
    signing_key_reference: input.signingKeyReference,
    contract_version: "do-external-webhook-v1",
    allowed_event_types: input.allowedEventTypes,
    revoked_at: null
  }, { onConflict: "observer_site_id,destination_fingerprint" }).select("id,observer_site_id,display_name,destination_host,provider_mode,active,contract_version,allowed_event_types,created_at,updated_at").single();
  if (saved.error) throw new Error("EXTERNAL_WEBHOOK_SAVE_FAILED");
  return saved.data;
}

export function externalApiMeta(actor: ExternalApiActor) {
  return { api_version: DIGITAL_OBSERVER_EXTERNAL_API_VERSION, request_id: actor.requestId, idempotent_replay: actor.idempotentReplay };
}
