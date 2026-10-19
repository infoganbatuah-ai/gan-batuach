/* eslint-disable @typescript-eslint/no-explicit-any -- external API reads canonical tables created across ordered migrations. */
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  encodeCursor, externalApiError, federationQuerySchema, ganBatuachRoleMapping,
  integrationCapabilityTruth, integrationDeepLinkSchema, investigationRequestSchema, parseCursor, siteQuerySchema,
  webhookSubscriptionSchema, watchRuleRequestSchema
} from "@/lib/domain/digital-observer/external-api-contract";
import { digitalObserverExternalOpenApi } from "@/lib/domain/digital-observer/external-api-openapi";
import {
  assertExternalApiRateLimit, authenticateExternalApiRequest, authorizeExternalApiSite, completeExternalApiReceipt,
  externalApiMeta, recordExternalApiUsage, registerExternalWebhook, type ExternalApiActor
} from "@/lib/domain/digital-observer/external-api-service";
import { compileInvestigationQuery, validateInvestigationQuery, type InvestigationCameraResource } from "@/lib/domain/digital-observer/investigation-query";
import { searchDigitalObserverInvestigation } from "@/lib/domain/digital-observer/investigation-search-service";
import { compileAuthorizedWatchRule, simulateWatchRuleAgainstRealHistory } from "@/lib/domain/digital-observer/watch-rule-service";
import { createSupabaseStorageBackend } from "@/lib/domain/digital-observer/storage-contract.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ segments: string[] }> };

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}

function codeFor(error: unknown) {
  const message = error instanceof Error ? error.message : "EXTERNAL_API_FAILED";
  if (/AUTH_REQUIRED|CREDENTIAL_INVALID|SIGNATURE|TIMESTAMP|NONCE/.test(message)) return [401, message] as const;
  if (/PERMISSION|SITE_SCOPE|ENTITLEMENT/.test(message)) return [403, message] as const;
  if (/REPLAY|IDEMPOTENCY/.test(message)) return [409, message] as const;
  if (/RATE_LIMITED/.test(message)) return [429, message] as const;
  if (/NOT_FOUND/.test(message)) return [404, message] as const;
  if (/INVALID|CURSOR|VALIDATION/.test(message)) return [422, message] as const;
  if (/UNAVAILABLE|FAILED/.test(message)) return [503, message] as const;
  return [500, "EXTERNAL_API_FAILED"] as const;
}

function queryInput(url: URL) {
  return siteQuerySchema.parse({ site_id: url.searchParams.get("site_id"), limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined, camera_id: url.searchParams.get("camera_id") ?? undefined,
    from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
}

function page<T>(rows: T[], offset: number, limit: number) {
  const more = rows.length > limit;
  return { data: rows.slice(0, limit), pagination: { limit, next_cursor: more ? encodeCursor(offset + limit) : null } };
}

async function runAuthorized(request: Request, body: string, siteId: string, scope: Parameters<typeof authorizeExternalApiSite>[2]["scope"], operation: string, handler: (context: { admin: any; actor: ExternalApiActor; site: any }) => Promise<Response>) {
  const { admin, actor } = await authenticateExternalApiRequest(request, body);
  if (actor.idempotentReplay) throw new Error("EXTERNAL_API_IDEMPOTENT_REPLAY");
  let authorized = false;
  try {
    const site = await authorizeExternalApiSite(admin, actor, { siteId, scope });
    authorized = true;
    await assertExternalApiRateLimit(admin, actor, siteId);
    const result = await handler({ admin, actor, site });
    await recordExternalApiUsage(admin, actor, { siteId, operation, status: result.status });
    await completeExternalApiReceipt(admin, actor, { status: result.status });
    return result;
  } catch (error) {
    const status = codeFor(error)[0];
    if (authorized) await recordExternalApiUsage(admin, actor, { siteId, operation, status }).catch(() => undefined);
    await completeExternalApiReceipt(admin, actor, { status, failed: true }).catch(() => undefined);
    throw error;
  }
}

async function listCameras(request: Request, body: string) {
  const input = queryInput(new URL(request.url)); const offset = parseCursor(input.cursor);
  return runAuthorized(request, body, input.site_id, "cameras.read", "cameras.list", async ({ admin, actor }) => {
    let query = admin.from("digital_observer_camera_sources")
      .select("id,observer_site_id,display_name,location_label,status,health_status,source_mode,last_health_check_at,last_seen_at,created_at")
      .eq("observer_site_id", input.site_id).order("created_at", { ascending: false }).range(offset, offset + input.limit);
    if (input.camera_id) query = query.eq("id", input.camera_id);
    const result = await query;
    if (result.error) throw new Error("EXTERNAL_API_CAMERA_READ_FAILED");
    return response({ ...page(result.data ?? [], offset, input.limit), ...externalApiMeta(actor) });
  });
}

async function listEvents(request: Request, body: string) {
  const input = queryInput(new URL(request.url)); const offset = parseCursor(input.cursor);
  return runAuthorized(request, body, input.site_id, "events.read", "events.list", async ({ admin, actor }) => {
    let query = admin.from("observer_intelligence_signals")
      .select("id,observer_site_id,camera_id,signal_type,severity,confidence,review_status,recommended_action,risk_score,human_review_required,created_at,reviewed_at,resolved_at")
      .eq("observer_site_id", input.site_id).order("created_at", { ascending: false }).range(offset, offset + input.limit);
    if (input.camera_id) query = query.eq("camera_id", input.camera_id);
    if (input.from) query = query.gte("created_at", input.from);
    if (input.to) query = query.lte("created_at", input.to);
    const result = await query;
    if (result.error) throw new Error("EXTERNAL_API_EVENT_READ_FAILED");
    return response({ ...page(result.data ?? [], offset, input.limit), ...externalApiMeta(actor), provenance_note: "Observed fields and inferred risk remain distinct." });
  });
}

async function listIncidents(request: Request, body: string) {
  const input = queryInput(new URL(request.url)); const offset = parseCursor(input.cursor);
  return runAuthorized(request, body, input.site_id, "incidents.read", "incidents.list", async ({ admin, actor }) => {
    let query = admin.from("observer_correlated_events")
      .select("id,observer_site_id,status,severity,confidence,title,summary,opened_at,last_activity_at,closed_at,primary_camera_source_id,involved_camera_ids,related_event_ids,timeline_summary,current_risk_score,current_risk_band,current_decision,current_verification_status,verification_classification,verification_confidence,final_decision")
      .eq("observer_site_id", input.site_id).order("last_activity_at", { ascending: false }).range(offset, offset + input.limit);
    if (input.from) query = query.gte("last_activity_at", input.from);
    if (input.to) query = query.lte("last_activity_at", input.to);
    const result = await query;
    if (result.error) throw new Error("EXTERNAL_API_INCIDENT_READ_FAILED");
    return response({ ...page(result.data ?? [], offset, input.limit), ...externalApiMeta(actor) });
  });
}

async function resourceDetail(request: Request, body: string, kind: "cameras" | "events" | "incidents", id: string) {
  const siteId = new URL(request.url).searchParams.get("site_id") ?? "";
  const contract = {
    cameras: { scope: "cameras.read" as const, table: "digital_observer_camera_sources", operation: "cameras.read",
      select: "id,observer_site_id,display_name,location_label,status,health_status,source_mode,last_health_check_at,last_seen_at,metadata,created_at,updated_at" },
    events: { scope: "events.read" as const, table: "observer_intelligence_signals", operation: "events.read",
      select: "id,observer_site_id,camera_id,signal_type,severity,confidence,review_status,recommended_action,risk_score,human_review_required,created_at,reviewed_at,resolved_at" },
    incidents: { scope: "incidents.read" as const, table: "observer_correlated_events", operation: "incidents.read",
      select: "id,observer_site_id,status,severity,confidence,title,summary,opened_at,last_activity_at,closed_at,primary_camera_source_id,involved_camera_ids,related_event_ids,timeline_summary,current_risk_score,current_risk_band,current_decision,current_verification_status,verification_classification,verification_confidence,final_decision" }
  }[kind];
  return runAuthorized(request, body, siteId, contract.scope, contract.operation, async ({ admin, actor }) => {
    const result = await admin.from(contract.table).select(contract.select).eq("id", id).eq("observer_site_id", siteId).maybeSingle();
    if (result.error || !result.data) throw new Error(`EXTERNAL_API_${kind.toUpperCase()}_NOT_FOUND`);
    const extra = kind === "incidents" ? { authorized_workflow_actions: ["open_in_product", "read_evidence"],
      mutations_require_first_party_human_authorization: true } : kind === "cameras" ? {
      authorized_open_camera_reference: `/digital-observer/live?site=${siteId}&camera=${id}`, unrestricted_stream_url_exposed: false } : {
      observed_and_inferred_fields_distinct: true };
    return response({ [kind.slice(0, -1)]: result.data, ...extra, ...externalApiMeta(actor) });
  });
}

async function evidence(request: Request, body: string, id: string, media: boolean) {
  const siteId = new URL(request.url).searchParams.get("site_id") ?? "";
  return runAuthorized(request, body, siteId, "evidence.read", media ? "evidence.media" : "evidence.read", async ({ admin, actor, site }) => {
    const clip = await admin.from("digital_observer_event_clips")
      .select("id,observer_site_id,camera_source_id,signal_id,clip_status,storage_bucket,storage_path,snapshot_storage_path,metadata,created_at")
      .eq("id", id).eq("observer_site_id", siteId).maybeSingle();
    if (clip.error || !clip.data) throw new Error("EXTERNAL_API_EVIDENCE_NOT_FOUND");
    if (!media) return response({ evidence: { id: clip.data.id, site_id: siteId, camera_id: clip.data.camera_source_id, event_id: clip.data.signal_id,
      status: clip.data.clip_status, media_embedded: false, media_access_path: `${new URL(request.url).pathname}/media?site_id=${siteId}`,
      product_path: `/digital-observer/events?site=${siteId}&evidence=${clip.data.id}`, created_at: clip.data.created_at }, ...externalApiMeta(actor) });
    const metadata = clip.data.metadata && typeof clip.data.metadata === "object" ? clip.data.metadata : {};
    if (clip.data.clip_status !== "available" || metadata.media_status === "failed") throw new Error("EXTERNAL_API_EVIDENCE_NOT_FOUND");
    const objectId = typeof metadata.clip_object_id === "string" ? metadata.clip_object_id : clip.data.storage_path;
    if (!clip.data.storage_bucket || !objectId) throw new Error("EXTERNAL_API_EVIDENCE_NOT_FOUND");
    if (metadata.storage_backend_id === "supabase-private-evidence") {
      const storage = createSupabaseStorageBackend({ client: admin, bucket: clip.data.storage_bucket });
      const access = await storage.authorize({ objectId, tenantId: site.owner_profile_id, siteId,
        actor: { tenantId: site.owner_profile_id, siteIds: [siteId] }, ttlSeconds: 60 });
      return NextResponse.redirect(access.url, { status: 307 });
    }
    const signed = await admin.storage.from(clip.data.storage_bucket).createSignedUrl(objectId, 60);
    if (signed.error || !signed.data?.signedUrl) throw new Error("EXTERNAL_API_EVIDENCE_SIGNING_FAILED");
    return NextResponse.redirect(signed.data.signedUrl, { status: 307 });
  });
}

function cameraResources(rows: any[]): InvestigationCameraResource[] {
  return rows.map((camera) => ({ id: camera.id, observerSiteId: camera.observer_site_id,
    name: camera.display_name ?? camera.location_label ?? `Camera ${String(camera.id).slice(0, 8)}`,
    locationLabel: camera.location_label, streamId: camera.camera_stream_id, aliases: [], zones: [] }));
}

async function investigation(request: Request, body: string) {
  const input = investigationRequestSchema.parse(JSON.parse(body));
  return runAuthorized(request, body, input.site_id, "investigations.run", "investigations.search", async ({ admin, actor, site }) => {
    const cameras = await admin.from("digital_observer_camera_sources")
      .select("id,observer_site_id,display_name,location_label,camera_stream_id").eq("observer_site_id", input.site_id).order("created_at");
    if (cameras.error) throw new Error("EXTERNAL_API_INVESTIGATION_SOURCES_FAILED");
    const compilation = compileInvestigationQuery({ question: input.question, context: { observerSiteId: input.site_id,
      timeZone: String(site.timezone ?? "Asia/Jerusalem"), cameras: cameraResources(cameras.data ?? []) },
      explicitCameraSourceId: input.camera_id, cursor: input.cursor, limit: input.limit });
    if (compilation.status !== "READY" || !compilation.query) return response({ status: compilation.status, compilation, result: null, ...externalApiMeta(actor) });
    const validation = validateInvestigationQuery(compilation.query);
    if (!validation.valid || !validation.query) throw new Error("EXTERNAL_API_INVESTIGATION_VALIDATION_FAILED");
    const result = await searchDigitalObserverInvestigation({ db: admin, query: validation.query,
      sources: (cameras.data ?? []).map((camera: any) => ({ id: camera.id, observer_site_id: camera.observer_site_id,
        display_name: camera.display_name, location_label: camera.location_label, camera_stream_id: camera.camera_stream_id })) });
    const investigationId = createHash("sha256").update(`${actor.organizationId}:${input.site_id}:${JSON.stringify(validation.query)}`).digest("hex");
    return response({ investigation_id: investigationId, status: "COMPLETED", compilation, result,
      report: { format: "grounded_result_v1", evidence_reference_count: result.grounding.evidenceIds.length,
        source_recording_retrieval_supported: false, unsupported_capabilities: ["face_recognition", "person_re_id", "vehicle_re_id"] },
      identity_or_movement_inference_is_certain: false, ...externalApiMeta(actor) });
  });
}

async function watchRules(request: Request, body: string) {
  if (request.method === "GET") {
    const input = queryInput(new URL(request.url));
    return runAuthorized(request, body, input.site_id, "watch_rules.read", "watch_rules.list", async ({ admin, actor }) => {
      const rules = await admin.from("observer_watch_requests").select("id,observer_site_id,camera_source_id,title,description,watch_type,active,priority,schedule,original_natural_language,structured_rule,validation_status,compiler_version,rule_version,rule_state,confirmed_at,last_matched_at,match_count,created_at,updated_at")
        .eq("observer_site_id", input.site_id).not("compiler_version", "is", null).order("updated_at", { ascending: false }).limit(100);
      if (rules.error) throw new Error("EXTERNAL_API_WATCH_RULE_READ_FAILED");
      return response({ data: rules.data ?? [], contract: { external_action_execution: false, confirmation_required_for_activation: true }, ...externalApiMeta(actor) });
    });
  }
  const input = watchRuleRequestSchema.parse(JSON.parse(body));
  return runAuthorized(request, body, input.site_id, "watch_rules.write", "watch_rules.manage", async ({ admin, actor, site }) => {
    if (input.action === "set_state") {
      const existing = await admin.from("observer_watch_requests").select("id,observer_site_id,compiler_version").eq("id", input.rule_id).eq("observer_site_id", input.site_id).maybeSingle();
      if (!existing.data?.compiler_version) throw new Error("EXTERNAL_API_WATCH_RULE_NOT_FOUND");
      const changed = await admin.rpc("set_digital_observer_watch_rule_state", { requested_rule_id: input.rule_id,
        requested_state: input.state, requested_idempotency_key: request.headers.get("idempotency-key") });
      if (changed.error || !changed.data) throw new Error("EXTERNAL_API_WATCH_RULE_STATE_FAILED");
      return response({ rule: changed.data, external_action_execution: false, ...externalApiMeta(actor) });
    }
    const compiled = await compileAuthorizedWatchRule({ db: admin, observerSiteId: input.site_id,
      timezone: String(site.timezone ?? "Asia/Jerusalem"), text: input.text, explicitCameraSourceId: input.camera_id });
    const simulation = compiled.compilation.candidate && compiled.compilation.validation.valid
      ? await simulateWatchRuleAgainstRealHistory({ db: admin, rule: compiled.compilation.candidate, days: 7 }) : null;
    return response({ compilation: compiled.compilation, simulation, activated: false,
      activation_requires_first_party_human_confirmation: true, external_action_execution: false, ...externalApiMeta(actor) });
  });
}

async function webhooks(request: Request, body: string) {
  if (request.method === "GET") {
    const input = queryInput(new URL(request.url));
    return runAuthorized(request, body, input.site_id, "webhooks.read", "webhooks.list", async ({ admin, actor }) => {
      const result = await admin.from("digital_observer_webhook_endpoints")
        .select("id,observer_site_id,display_name,destination_host,provider_mode,active,signing_key_version,contract_version,allowed_event_types,revoked_at,created_at,updated_at")
        .eq("observer_site_id", input.site_id).eq("service_account_id", actor.serviceAccountId).order("created_at", { ascending: false }).limit(100);
      if (result.error) throw new Error("EXTERNAL_WEBHOOK_READ_FAILED");
      return response({ data: result.data ?? [], private_destinations_exposed: false, ...externalApiMeta(actor) });
    });
  }
  const input = webhookSubscriptionSchema.parse(JSON.parse(body));
  const { admin, actor } = await authenticateExternalApiRequest(request, body);
  if (actor.idempotentReplay) throw new Error("EXTERNAL_API_IDEMPOTENT_REPLAY");
  try {
    await assertExternalApiRateLimit(admin, actor, input.site_id);
    if (input.action === "register") {
      const subscription = await registerExternalWebhook(admin, actor, { siteId: input.site_id, displayName: input.display_name,
        destinationUrl: input.destination_url, allowedEventTypes: input.allowed_event_types, mode: input.mode, signingKeyReference: input.signing_key_reference });
      await recordExternalApiUsage(admin, actor, { siteId: input.site_id, operation: "webhooks.create", status: 201 });
      await completeExternalApiReceipt(admin, actor, { status: 201 });
      return response({ subscription, delivery_proof: "NOT_PROVEN", ...externalApiMeta(actor) }, 201);
    }
    await authorizeExternalApiSite(admin, actor, { siteId: input.site_id, scope: "webhooks.write" });
    const existing = await admin.from("digital_observer_webhook_endpoints").select("id,signing_key_version")
      .eq("id", input.subscription_id).eq("observer_site_id", input.site_id).eq("service_account_id", actor.serviceAccountId).maybeSingle();
    if (!existing.data) throw new Error("EXTERNAL_WEBHOOK_NOT_FOUND");
    const update = input.action === "revoke"
      ? { active: false, revoked_at: new Date().toISOString() }
      : { signing_key_reference: input.signing_key_reference, signing_key_version: Number(existing.data.signing_key_version) + 1, updated_at: new Date().toISOString() };
    const changed = await admin.from("digital_observer_webhook_endpoints").update(update).eq("id", input.subscription_id)
      .select("id,observer_site_id,display_name,destination_host,provider_mode,active,signing_key_version,contract_version,revoked_at,updated_at").single();
    if (changed.error) throw new Error("EXTERNAL_WEBHOOK_UPDATE_FAILED");
    await recordExternalApiUsage(admin, actor, { siteId: input.site_id, operation: `webhooks.${input.action}`, status: 200 });
    await completeExternalApiReceipt(admin, actor, { status: 200 });
    return response({ subscription: changed.data, delivery_proof: "NOT_PROVEN", ...externalApiMeta(actor) });
  } catch (error) {
    await completeExternalApiReceipt(admin, actor, { status: codeFor(error)[0], failed: true }).catch(() => undefined);
    throw error;
  }
}

async function integrationCapabilities(request: Request, body: string) {
  const input = queryInput(new URL(request.url));
  return runAuthorized(request, body, input.site_id, "integrations.read", "integrations.capabilities", async ({ admin, actor }) => {
    const rows = await admin.from("digital_observer_external_integration_sources")
      .select("id,integration_kind,display_name,provider_key,provider_mode,connection_status,capability_manifest,deep_link_template,real_proof_status,last_health_at")
      .eq("observer_site_id", input.site_id).eq("organization_id", actor.organizationId).order("created_at");
    if (rows.error) throw new Error("EXTERNAL_INTEGRATION_READ_FAILED");
    const data = (rows.data ?? []).map((row: any) => ({ ...row, deep_link_template: undefined,
      truth: integrationCapabilityTruth({ kind: row.integration_kind, configured: row.connection_status === "connected",
        realProof: row.real_proof_status === "real_proven", supportsDeepLink: Boolean(row.deep_link_template) }) }));
    return response({ data, universal_compatibility_claimed: false, credentials_exposed: false, ...externalApiMeta(actor) });
  });
}

async function federation(request: Request, body: string) {
  const input = federationQuerySchema.parse(JSON.parse(body));
  return runAuthorized(request, body, input.site_id, "federation.query", "federation.query", async ({ admin, actor }) => {
    const sources = await admin.from("digital_observer_external_integration_sources")
      .select("id,integration_kind,provider_key,provider_mode,connection_status,capability_manifest,real_proof_status")
      .eq("observer_site_id", input.site_id).eq("organization_id", actor.organizationId).in("id", input.source_ids);
    if (sources.error || (sources.data ?? []).length !== input.source_ids.length) throw new Error("EXTERNAL_API_FEDERATION_SOURCE_NOT_FOUND");
    return response({ status: "NOT_EXECUTED", reason: "No approved external source adapter is active.", sources: sources.data,
      query_digest: createHash("sha256").update(input.query).digest("hex"), copied_video: false, credentials_exposed: false,
      observed_facts: [], inferred_movements: [], ...externalApiMeta(actor) });
  });
}

async function integrationDeepLink(request: Request, body: string) {
  const input = integrationDeepLinkSchema.parse(JSON.parse(body));
  return runAuthorized(request, body, input.site_id, "integrations.read", "integrations.deep_link", async ({ admin, actor }) => {
    const source = await admin.from("digital_observer_external_integration_sources")
      .select("id,provider_key,connection_status,deep_link_template,real_proof_status")
      .eq("id", input.source_id).eq("observer_site_id", input.site_id).eq("organization_id", actor.organizationId).maybeSingle();
    if (source.error || !source.data || source.data.connection_status !== "connected" || !source.data.deep_link_template) {
      throw new Error("EXTERNAL_API_INTEGRATION_DEEP_LINK_NOT_FOUND");
    }
    const value = String(source.data.deep_link_template).replaceAll("{resource_id}", encodeURIComponent(input.resource_id));
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("EXTERNAL_API_INTEGRATION_DEEP_LINK_INVALID");
    return response({ deep_link: parsed.toString(), provider_key: source.data.provider_key,
      real_proof_status: source.data.real_proof_status, credentials_exposed: false, ...externalApiMeta(actor) });
  });
}

async function ganBatuachContract(request: Request, body: string) {
  const siteId = new URL(request.url).searchParams.get("site_id") ?? "";
  return runAuthorized(request, body, siteId, "gan_batuach.read", "gan_batuach.contract", async ({ actor }) => response({
    contract: "digital-observer-gan-batuach-boundary-v1", data_plane: "separate_authorization_domain",
    direct_table_sharing: false, parent_access_inherited: false, child_privacy_approval_gate: "PUSH_45",
    operational_proof_owner: "PUSH_47", role_mapping: ganBatuachRoleMapping,
    data_endpoint: `/api/digital-observer/integration/v1/sites/${siteId}/status`, ...externalApiMeta(actor)
  }));
}

async function dispatch(request: Request, context: Context) {
  const { segments } = await context.params;
  if (request.method === "GET" && segments.join("/") === "openapi.json") return response(digitalObserverExternalOpenApi);
  const body = request.method === "GET" ? "" : await request.text();
  const path = segments.join("/");
  if (request.method === "GET" && path === "cameras") return listCameras(request, body);
  if (request.method === "GET" && segments[0] === "cameras" && segments[1]) return resourceDetail(request, body, "cameras", segments[1]);
  if (request.method === "GET" && path === "events") return listEvents(request, body);
  if (request.method === "GET" && segments[0] === "events" && segments[1]) return resourceDetail(request, body, "events", segments[1]);
  if (request.method === "GET" && path === "incidents") return listIncidents(request, body);
  if (request.method === "GET" && segments[0] === "incidents" && segments[1]) return resourceDetail(request, body, "incidents", segments[1]);
  if (request.method === "POST" && path === "investigations/search") return investigation(request, body);
  if (["GET", "POST"].includes(request.method) && path === "watch-rules") return watchRules(request, body);
  if (["GET", "POST"].includes(request.method) && path === "webhooks/subscriptions") return webhooks(request, body);
  if (request.method === "GET" && path === "integrations/capabilities") return integrationCapabilities(request, body);
  if (request.method === "POST" && path === "integrations/deep-links") return integrationDeepLink(request, body);
  if (request.method === "POST" && path === "federation/query") return federation(request, body);
  if (request.method === "GET" && path === "gan-batuach/contract") return ganBatuachContract(request, body);
  if (request.method === "GET" && segments[0] === "evidence" && segments[1]) return evidence(request, body, segments[1], segments[2] === "media");
  return response(externalApiError("EXTERNAL_API_ROUTE_NOT_FOUND", request.headers.get("x-request-id") ?? "unknown"), 404);
}

async function handle(request: Request, context: Context) {
  try { return await dispatch(request, context); }
  catch (error) {
    const [status, code] = codeFor(error);
    return response(externalApiError(code, request.headers.get("x-request-id")?.slice(0, 120) ?? "unknown"), status);
  }
}

export const GET = handle;
export const POST = handle;
