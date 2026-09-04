import "server-only";
import { z } from "zod";
import type { createAdminClient } from "@/lib/supabase/admin";
import { cameraActionSchema } from "./camera-action-schema";
import { getObserverSiteAccess } from "./access";
import { cameraQueueResultSchema, cameraQueueSelect, CAMERA_QUEUE_TTL_MS, canonicalDigest, queueBindingMatches, queueResultDigest, queueTask, validateQueueResult, type CameraQueueRow } from "./camera-queue-contract";
import type { GuardDiagnosticAdapter, GuardDiagnosticRequest, GuardDiagnosticScope, GuardDiagnosticView } from "./guard-diagnostics-types";

export const diagnosticScopeSchema = z.object({ observer_site_id: z.string().uuid(), camera_source_id: z.string().uuid(), request_id: z.string().uuid() }).strict();
export const diagnosticRequestSchema = z.union([
  diagnosticScopeSchema.extend({ task_kind: z.literal("capability_snapshot") }).strict(),
  // Reuse the physical command's bounded payload shapes, NOT its confirmation.
  // A diagnostic does not invent or accept human consent to execute a command.
  ...cameraActionSchema.options.map(option => option.omit({ requested_at: true, confirmed: true })
    .extend({ observer_site_id: z.string().uuid(), task_kind: z.literal("command_preflight") }).strict())
]);
type Profile = { id: string; role?: string | null; active?: boolean | null };
type DatabaseClient = ReturnType<typeof createAdminClient>;
type Row = CameraQueueRow & { idempotency_key?: string | null; result?: Record<string, unknown> | null };
type SourceRow = { id: string; observer_site_id: string; connector_type: string; gateway_id: string; stream_id: string; channel: number };
type Dependencies = { sessionDb: DatabaseClient; admin: () => DatabaseClient; profile: Profile; origin: "dashboard" | "observer_chat"; now?: () => number };
const sourceColumns = "id,observer_site_id,connector_type,display_name,location_label,gateway_id:metadata->>gateway_id,stream_id:metadata->>gateway_stream_id,channel:metadata->dvr_channel";
const bindingSchema = z.object({ gateway_id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/), stream_id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/), channel: z.number().int().min(1).max(64) });

const hash = canonicalDigest;
const unavailable = () => new Error("DIAGNOSTIC_STORAGE_UNAVAILABLE");

/** Authenticated Standard site boundary. Never uses the elevated client until
 * the session client and current site/camera mapping have been checked. */
export class GuardDiagnosticsService implements GuardDiagnosticAdapter {
  constructor(private readonly deps: Dependencies) {}
  private now() { return this.deps.now?.() ?? Date.now(); }

  async source(input: GuardDiagnosticScope) {
    diagnosticScopeSchema.parse({ observer_site_id: input.observer_site_id, camera_source_id: input.camera_source_id, request_id: input.request_id });
    if (this.deps.profile.active !== true) throw new Error("DIAGNOSTIC_FORBIDDEN");
    const site = await getObserverSiteAccess(this.deps.sessionDb, this.deps.profile, input.observer_site_id, { manage: true });
    if (!site || !["home", "business"].includes(site.site_type) || site.garden_id
      || site.business_handles_children === true || site.vision_privacy_mode !== "standard_consent") throw new Error("DIAGNOSTIC_FORBIDDEN");
    const found = await this.deps.sessionDb.from("digital_observer_camera_sources").select(sourceColumns)
      .eq("id", input.camera_source_id).eq("observer_site_id", site.id).maybeSingle();
    if (found.error) throw unavailable();
    const source = found.data as unknown as SourceRow | null;
    if (!source || source.id !== input.camera_source_id || source.observer_site_id !== site.id || source.connector_type === "demo") throw new Error("DIAGNOSTIC_CAMERA_FORBIDDEN");
    bindingSchema.parse(source);
    return source;
  }

  private find(db: DatabaseClient, input: GuardDiagnosticScope) {
    return db.from("digital_observer_camera_action_requests")
      .select(`${cameraQueueSelect},requested_by,idempotency_key,request_origin,result`)
      .eq("id", input.request_id).eq("observer_site_id", input.observer_site_id)
      .eq("camera_source_id", input.camera_source_id).eq("requested_by", this.deps.profile.id).maybeSingle();
  }

  private matchesRequest(row: Row, input: GuardDiagnosticRequest) {
    return row.task_kind === input.task_kind && row.request_origin === this.deps.origin
      && row.action_type === (input.task_kind === "command_preflight" ? input.action : "capability_snapshot")
      && row.payload_digest === (input.task_kind === "command_preflight" ? hash({ action: input.action, payload: input.payload }) : null)
      && row.idempotency_key === `guard-diagnostic:${this.deps.profile.id}:${input.request_id}`;
  }

  private view(row: Row, source: SourceRow): GuardDiagnosticView {
    const binding = { id: source.id, observer_site_id: source.observer_site_id,
      metadata: { gateway_id: source.gateway_id, gateway_stream_id: source.stream_id, dvr_channel: source.channel } };
    if (!queueBindingMatches(row, binding, { gateway_id: source.gateway_id, observer_site_id: source.observer_site_id })
      || (row.task_kind !== "capability_snapshot" && row.task_kind !== "command_preflight")) throw new Error("DIAGNOSTIC_MAPPING_CHANGED");
    const states: Record<string, GuardDiagnosticView["state"]> = { approved: "queued", delivered: "running", completed: "completed", failed: "failed", expired: "expired", blocked: "blocked", cancelled: "cancelled" };
    let state = states[row.action_status];
    if (!state || !Number.isFinite(Date.parse(row.expires_at))) throw unavailable();
    if (Date.parse(row.expires_at) <= this.now() && ["queued", "running", "completed"].includes(state)) state = "expired";
    const view: GuardDiagnosticView = { request_id: row.id, camera_source_id: row.camera_source_id, task_kind: row.task_kind,
      state, expires_at: row.expires_at, audit_recorded: true, executed: false, executor_installed: false, requires_immediate_confirmation: true };
    if (state !== "completed") return view;
    const { reported_by_gateway, ...wire } = row.result ?? {};
    const parsed = cameraQueueResultSchema.parse(wire);
    if (reported_by_gateway !== true || parsed.request_id !== row.id || queueResultDigest(parsed) !== row.result_digest) throw new Error("DIAGNOSTIC_EVIDENCE_INVALID");
    validateQueueResult(parsed, row, this.now());
    if (parsed.outcome !== "capability_snapshot" && parsed.outcome !== "command_preflight") {
      throw new Error("DIAGNOSTIC_EVIDENCE_INVALID");
    }
    if (parsed.outcome === "capability_snapshot") {
      return { ...view, evidence_id: parsed.outcome_payload.evidence_id, verified_at: parsed.outcome_payload.verified_at,
        capabilities: parsed.outcome_payload.capabilities };
    }
    return { ...view, evidence_id: parsed.outcome_payload.evidence_id, verified_at: parsed.outcome_payload.verified_at,
      action: parsed.outcome_payload.action, supported: parsed.outcome_payload.supported };
  }

  async request(value: GuardDiagnosticRequest): Promise<GuardDiagnosticView> {
    const input = diagnosticRequestSchema.parse(value);
    const source = await this.source(input);
    const admin = this.deps.admin();
    const digest = hash({ ...input, actor: this.deps.profile.id, origin: this.deps.origin,
      binding: { gateway_id: source.gateway_id, stream_id: source.stream_id, channel: source.channel } });
    let requestedAt = new Date(this.now()).toISOString();
    let expiresAt = new Date(this.now() + CAMERA_QUEUE_TTL_MS - 1000).toISOString();
    const audit = await admin.from("immutable_audit_events").insert({
      id: input.request_id, request_id: input.request_id, event_category: "camera", event_type: "guard_diagnostic_request",
      actor_profile_id: this.deps.profile.id, actor_role: this.deps.profile.role, target_type: "digital_observer_camera_source",
      target_id: input.camera_source_id, camera_id: input.camera_source_id, risk_level: "low",
      metadata: { request_digest: digest, task_kind: input.task_kind, observer_site_id: input.observer_site_id,
        requested_at: requestedAt, expires_at: expiresAt, executed: false, physical_confirmation: false }
    }).select("id").maybeSingle();
    if (audit.error?.code === "23505") {
      const previous = await admin.from("immutable_audit_events").select("id,event_type,actor_profile_id,target_id,metadata").eq("id", input.request_id).maybeSingle();
      if (previous.error) throw unavailable();
      if (!previous.data || previous.data.event_type !== "guard_diagnostic_request" || previous.data.actor_profile_id !== this.deps.profile.id
        || previous.data.target_id !== input.camera_source_id || previous.data.metadata?.request_digest !== digest) throw new Error("DIAGNOSTIC_REQUEST_CONFLICT");
      requestedAt = previous.data.metadata.requested_at;
      expiresAt = previous.data.metadata.expires_at;
      const existing = await this.find(admin, input);
      if (existing.error) throw unavailable();
      if (existing.data) {
        const existingRow = existing.data as unknown as Row;
        if (!this.matchesRequest(existingRow, input)) throw new Error("DIAGNOSTIC_REQUEST_CONFLICT");
        return this.view(existingRow, source);
      }
    } else if (audit.error || !audit.data) throw unavailable();

    const row: Row = {
      id: input.request_id, observer_site_id: input.observer_site_id, camera_source_id: input.camera_source_id,
      requested_by: this.deps.profile.id, request_origin: this.deps.origin, task_kind: input.task_kind,
      gateway_id: source.gateway_id, stream_id: source.stream_id, channel: source.channel,
      requested_at: requestedAt, expires_at: expiresAt, action_type: input.task_kind === "command_preflight" ? input.action : "capability_snapshot",
      payload_digest: input.task_kind === "command_preflight" ? hash({ action: input.action, payload: input.payload }) : null,
      // No text, raw command payload, camera secret or physical approval enters the queue.
      parameters: {}, capability_evidence: {}, action_status: "approved", result_digest: null,
      idempotency_key: `guard-diagnostic:${this.deps.profile.id}:${input.request_id}`
    };
    queueTask(row, this.now()); // Slow audit writes cannot renew the lifetime.
    const inserted = await admin.from("digital_observer_camera_action_requests").insert(row).select("id").maybeSingle();
    if (inserted.error && inserted.error.code !== "23505") throw unavailable();
    if (!inserted.error && !inserted.data) throw unavailable();
    const saved = await this.find(admin, input);
    if (saved.error || !saved.data) throw unavailable();
    const savedRow = saved.data as unknown as Row;
    if (!this.matchesRequest(savedRow, input)) throw new Error("DIAGNOSTIC_REQUEST_CONFLICT");
    return this.view(savedRow, source);
  }

  async status(value: GuardDiagnosticScope): Promise<GuardDiagnosticView> {
    const input = diagnosticScopeSchema.parse(value);
    const source = await this.source(input);
    const found = await this.find(this.deps.sessionDb, input);
    if (found.error) throw unavailable();
    if (!found.data) throw new Error("DIAGNOSTIC_NOT_FOUND");
    // Rows from older producers are not claimed to have this service's audit.
    const foundRow = found.data as unknown as Row;
    if (foundRow.idempotency_key !== `guard-diagnostic:${this.deps.profile.id}:${input.request_id}`) throw new Error("DIAGNOSTIC_NOT_FOUND");
    const audit = await this.deps.admin().from("immutable_audit_events").select("id,event_type,actor_profile_id,target_id,metadata")
      .eq("id", input.request_id).eq("actor_profile_id", this.deps.profile.id).eq("target_id", input.camera_source_id).maybeSingle();
    if (audit.error) throw unavailable();
    if (!audit.data || audit.data.event_type !== "guard_diagnostic_request" || audit.data.metadata?.observer_site_id !== input.observer_site_id
      || audit.data.metadata?.task_kind !== foundRow.task_kind
      || audit.data.metadata?.executed !== false || audit.data.metadata?.physical_confirmation !== false
      || Date.parse(audit.data.metadata?.requested_at) !== Date.parse(foundRow.requested_at ?? "")
      || Date.parse(audit.data.metadata?.expires_at) !== Date.parse(foundRow.expires_at)) throw new Error("DIAGNOSTIC_EVIDENCE_INVALID");
    return this.view(foundRow, source);
  }
}
