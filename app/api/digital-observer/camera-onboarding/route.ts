/* eslint-disable @typescript-eslint/no-explicit-any -- the onboarding draft and source columns are migration-backed but intentionally absent from the generated schema snapshot. */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { observerCameraPairingMethods } from "@/lib/domain/digital-observer/camera-connection-methods";
import { digitalObserverConnectorTypes } from "@/lib/domain/digital-observer/connectors";
import {
  assertSafeCameraConnectionAssessmentPayload,
  assessCameraConnection,
  buildExistingSourceAssessmentInput,
  buildPairingConnectionAssessmentInput
} from "@/lib/domain/digital-observer/camera-connection-layer";
import {
  assertCameraOnboardingTransition,
  cameraOnboardingStates,
  cameraSystemKinds,
  credentialStateForAssessment,
  isActiveMonitoringSource,
  onboardingStateForAssessment,
  safeOnboardingSession,
  simpleConnectionReason,
  type CameraOnboardingSession
} from "@/lib/domain/digital-observer/camera-onboarding";

const safeMappingSchema = z.object({
  stable_channel_reference: z.string().trim().min(1).max(80),
  suggested_name: z.string().trim().min(2).max(100),
  location_label: z.string().trim().max(100).nullable().optional(),
  selected: z.boolean().default(true),
  duplicate_candidate: z.boolean().default(false)
}).strict();

const scopeSchema = z.object({ observer_site_id: z.string().uuid() }).strict();
const saveSchema = scopeSchema.extend({
  action: z.literal("save"),
  system_kind: z.enum(cameraSystemKinds),
  connector_type: z.enum(digitalObserverConnectorTypes),
  connector_provider: z.string().trim().min(1).max(80).default("unknown"),
  pairing_method: z.enum(observerCameraPairingMethods),
  pairing_payload_kind: z.enum(["rtsp", "onvif", "web_link", "vendor_code", "unknown"]).default("unknown"),
  mappings: z.array(safeMappingSchema).max(64).default([]),
  requested_state: z.enum(cameraOnboardingStates).optional()
}).strict();
const attachSourceSchema = scopeSchema.extend({ action: z.literal("attach_source"), camera_source_id: z.string().uuid() }).strict();
const activateSchema = scopeSchema.extend({ action: z.literal("activate"), camera_source_id: z.string().uuid() }).strict();
const schema = z.discriminatedUnion("action", [scopeSchema.extend({ action: z.literal("get") }), saveSchema, attachSourceSchema, activateSchema]);

function redactUnsafeOnboardingPayload(payload: unknown) {
  assertSafeCameraConnectionAssessmentPayload(payload);
}

function fromDraft(draft: any, siteId: string) {
  const raw = draft?.metadata?.camera_connection_onboarding?.[siteId];
  return raw ? safeOnboardingSession(raw) : null;
}

async function loadDraft(supabase: any, profileId: string, siteId: string) {
  const result = await supabase.from("observer_site_onboarding_drafts" as any)
    .select("id,metadata,updated_at")
    .eq("profile_id", profileId)
    .eq("activated_observer_site_id", siteId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return result.data;
}

async function persistSession(supabase: any, profileId: string, site: any, currentDraft: any, session: CameraOnboardingSession, auditAction: string) {
  const currentMetadata = currentDraft?.metadata && typeof currentDraft.metadata === "object" ? currentDraft.metadata : {};
  const priorAudit = Array.isArray(currentMetadata.camera_connection_onboarding_audit) ? currentMetadata.camera_connection_onboarding_audit : [];
  const metadata = {
    ...currentMetadata,
    camera_connection_onboarding: { ...(currentMetadata.camera_connection_onboarding ?? {}), [site.id]: session },
    camera_connection_onboarding_audit: [...priorAudit.slice(-19), {
      action: auditAction,
      observer_site_id: site.id,
      state: session.state,
      diagnostic_id: session.diagnosticId,
      at: new Date().toISOString()
    }]
  };
  const patch = { profile_id: profileId, status: "activated", site_name: site.name, site_type: site.site_type, owner_type: site.site_type === "home" ? "home_owner" : "business_owner", timezone: site.timezone || "Asia/Jerusalem", activated_observer_site_id: site.id, metadata, updated_at: new Date().toISOString() };
  if (currentDraft?.id) {
    const update = await supabase.from("observer_site_onboarding_drafts" as any).update(patch).eq("id", currentDraft.id);
    if (update.error) throw new Error("CAMERA_ONBOARDING_RESUME_SAVE_FAILED");
  } else {
    const insert = await supabase.from("observer_site_onboarding_drafts" as any).insert(patch);
    if (insert.error) throw new Error("CAMERA_ONBOARDING_RESUME_CREATE_FAILED");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await request.json());
    redactUnsafeOnboardingPayload(payload);
    const site = await getObserverSiteAccess(session.supabase, session.profile, payload.observer_site_id, payload.action === "get" ? {} : { manage: true });
    if (!site) return fail(payload.action === "get" ? "אין הרשאה לצפות במצב החיבור באתר הזה." : "אין הרשאת ניהול לחיבור באתר הזה.", 403);
    const supabase = session.supabase as any;
    const draft = await loadDraft(supabase, session.profile.id, site.id);

    if (payload.action === "get") {
      const existing = fromDraft(draft, site.id);
      return ok({ session: existing ?? safeOnboardingSession({ observerSiteId: site.id, diagnosticId: randomUUID(), state: "START" }) });
    }

    if (payload.action === "save") {
      const assessment = assessCameraConnection(buildPairingConnectionAssessmentInput({
        siteId: site.id,
        connectorType: payload.connector_type,
        provider: payload.connector_provider,
        pairingMethod: payload.pairing_method,
        pairingPayloadKind: payload.pairing_payload_kind
      }));
      const previous = fromDraft(draft, site.id);
      const derivedState = payload.requested_state ?? onboardingStateForAssessment(assessment);
      assertCameraOnboardingTransition(previous?.state ?? "START", derivedState);
      const next = safeOnboardingSession({
        observerSiteId: site.id,
        diagnosticId: previous?.diagnosticId || randomUUID(),
        state: derivedState,
        systemKind: payload.system_kind,
        connectorType: payload.connector_type,
        connectorProvider: payload.connector_provider,
        pairingMethod: payload.pairing_method,
        pairingPayloadKind: payload.pairing_payload_kind,
        credentialState: credentialStateForAssessment(assessment),
        assessment,
        mappings: payload.mappings.map((item) => ({ stableChannelReference: item.stable_channel_reference, suggestedName: item.suggested_name, locationLabel: item.location_label ?? null, selected: item.selected, duplicateCandidate: item.duplicate_candidate })),
        sourceId: previous?.sourceId ?? null,
        lastErrorCategory: assessment.productionEligible ? null : assessment.missingRequirements[0] ?? "CONNECTION_REQUIREMENTS_PENDING",
        updatedAt: new Date().toISOString()
      });
      await persistSession(supabase, session.profile.id, site, draft, next, "assessment_saved");
      return ok({ session: next, explanation: simpleConnectionReason(assessment.recommendation, assessment.reasonCodes), resume_supported: true });
    }

    const sourceResult = await supabase.from("digital_observer_camera_sources" as any)
      .select("id,observer_site_id,status,health_status,source_mode,last_seen_at,connector_type,connector_provider,metadata")
      .eq("id", payload.camera_source_id).eq("observer_site_id", site.id).maybeSingle();
    if (sourceResult.error || !sourceResult.data) return fail("מקור המצלמה לא נמצא באתר הזה.", 404);
    const source = sourceResult.data;
    const previous = fromDraft(draft, site.id);
    if (payload.action === "attach_source") {
      const nextState = source.status === "draft" ? "TESTING" : isActiveMonitoringSource(source) ? "ACTIVE" : "READY_TO_ACTIVATE";
      assertCameraOnboardingTransition(previous?.state ?? "CAMERA_MAPPING", nextState);
      const assessment = assessCameraConnection(buildExistingSourceAssessmentInput(source));
      const next = safeOnboardingSession({
        ...(previous ?? {}), observerSiteId: site.id, diagnosticId: previous?.diagnosticId || randomUUID(), state: nextState,
        connectorType: source.connector_type, connectorProvider: source.connector_provider, sourceId: source.id,
        credentialState: credentialStateForAssessment(assessment), assessment, updatedAt: new Date().toISOString()
      });
      await persistSession(supabase, session.profile.id, site, draft, next, "source_mapped");
      return ok({ session: next, message: isActiveMonitoringSource(source) ? "המקור הקיים פעיל; לא בוצע רישום מחדש." : "המקור ממופה. יש להשלים בדיקת חיבור אמיתית לפני הפעלה." });
    }
    const active = isActiveMonitoringSource(source);
    const assessment = assessCameraConnection(buildExistingSourceAssessmentInput(source));
    const nextState = active ? "ACTIVE" : "ACTION_REQUIRED";
    assertCameraOnboardingTransition(previous?.state ?? "READY_TO_ACTIVATE", nextState);
    const next = safeOnboardingSession({
      ...(previous ?? {}), observerSiteId: site.id, diagnosticId: previous?.diagnosticId || randomUUID(), state: nextState,
      connectorType: source.connector_type, connectorProvider: source.connector_provider, sourceId: source.id,
      credentialState: active ? "VERIFIED" : credentialStateForAssessment(assessment), assessment,
      lastErrorCategory: active ? null : "RUNTIME_STREAM_NOT_HEALTHY", updatedAt: new Date().toISOString()
    });
    await persistSession(supabase, session.profile.id, site, draft, next, active ? "activation_confirmed" : "activation_blocked");
    if (!active) return fail("המצלמה נשמרה אך עדיין אינה מנוטרת: נדרש מקור חי, בריא ורענן לפני הפעלה.", 409, { session: next });
    return ok({ session: next, message: "המצלמה פעילה ומנוטרת דרך מסלול החיבור המאומת." });
  } catch (error) {
    return handleRouteError(error);
  }
}
