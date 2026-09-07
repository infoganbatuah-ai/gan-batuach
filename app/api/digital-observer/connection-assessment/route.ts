import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { connectionFailureCategories, connectionPlanRequestSchema, connectionOrchestratorVersion } from "@/lib/domain/digital-observer/connection-orchestrator";
import { assessAuthorizedCameraSystem } from "@/lib/domain/digital-observer/connection-assessment-service";
import { recordConnectivityOutcome } from "@/lib/domain/digital-observer/connection-outcome-service";
import { connectivityFamilyIds, connectivityRegistryVersion, connectionStrategies } from "@/lib/domain/digital-observer/connectivity-registry";
import { writeAuditEvent } from "@/lib/security/audit-log-service";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createDigitalObserverAdminDataClient, hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import { observerCameraPairingMethods } from "@/lib/domain/digital-observer/camera-connection-methods";
import {
  assertSafeCameraConnectionAssessmentPayload,
  assessCameraConnection,
  buildExistingSourceAssessmentInput,
  buildPairingConnectionAssessmentInput,
  cameraConnectionMetadataForAssessment
} from "@/lib/domain/digital-observer/camera-connection-layer";
import { digitalObserverConnectorTypes } from "@/lib/domain/digital-observer/connectors";

const assessNewSchema = z.object({
  action: z.literal("assess_new"),
  observer_site_id: z.string().uuid(),
  connector_type: z.enum(digitalObserverConnectorTypes),
  connector_provider: z.string().trim().min(1).max(80).optional().default("unknown"),
  pairing_method: z.enum(observerCameraPairingMethods).optional().default("manual_network"),
  pairing_payload_kind: z.enum(["rtsp", "onvif", "web_link", "vendor_code", "unknown"]).optional().default("unknown")
}).strict();

const assessExistingSchema = z.object({
  action: z.literal("assess_existing"),
  observer_site_id: z.string().uuid(),
  camera_source_id: z.string().uuid(),
  persist: z.boolean().optional().default(false)
}).strict();

const reportFailureSchema = z.object({ action: z.literal("record_failure"), observer_site_id: z.string().uuid(),
  attempt_id: z.string().uuid(), family: z.enum(connectivityFamilyIds), computer_available: z.enum(["YES", "NO", "UNKNOWN"]).default("UNKNOWN"),
  failure: z.enum(connectionFailureCategories), strategy: z.enum(connectionStrategies).nullable().default(null),
  effort: z.object({ product_actions: z.number().int().min(0).max(1000), technical_actions: z.number().int().min(0).max(1000),
    installer_actions: z.number().int().min(0).max(100), external_app_actions: z.number().int().min(0).max(100),
    elapsed_ms: z.number().int().min(0).max(7 * 86400000), support_required: z.boolean() }).strict() }).strict();

const schema = z.discriminatedUnion("action", [assessNewSchema, assessExistingSchema, connectionPlanRequestSchema, reportFailureSchema]);

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await parseBoundedJson(request, 4096));
    await assertRateLimit(privateRateLimitIdentifier({ userId: session.profile.id, tenantId: payload.observer_site_id, headers: request.headers }), "digital-observer:connection-assessment", 30, 60);
    assertSafeCameraConnectionAssessmentPayload(payload);
    const { profile, supabase: sessionSupabase } = session;
    const observerAdmin = hasObserverAdminClaim(session.user.app_metadata);
    // The runtime table is migration-backed and not yet present in the generated Supabase type snapshot.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (observerAdmin ? createDigitalObserverAdminDataClient() : sessionSupabase) as any;
    const requiresManageAccess = payload.action !== "assess_existing" || payload.persist;
    const site = observerAdmin
      ? (await supabase.from("observer_sites")
        .select("id,site_type,garden_id")
        .eq("id", payload.observer_site_id)
        .is("garden_id", null)
        .neq("site_type", "kindergarten")
        .maybeSingle()).data
      : await getObserverSiteAccess(
        sessionSupabase,
        profile,
        payload.observer_site_id,
        requiresManageAccess ? { manage: true } : {}
      );
    if (!site) return fail(requiresManageAccess
      ? "אין הרשאת ניהול לחיבורי המצלמות באתר הזה."
      : "אין הרשאה לבדוק חיבור מצלמות באתר הזה.", 403);

    if (payload.action === "plan") {
      // Privileged enrollment reads happen only after site authorization above.
      const { plan, connectorOnline } = await assessAuthorizedCameraSystem(site.id, payload.family, payload.computer_available);
      const diagnosticId = randomUUID();
      await writeAuditEvent({ eventType: "connectivity_assessment_completed", eventCategory: "camera",
        actorProfileId: profile.id, actorRole: profile.role, targetType: "observer_site", targetId: site.id,
        requestId: diagnosticId, riskLevel: "low", metadata: {
          family: plan.family, strategy: plan.preferredStrategy, classification: plan.classification,
          next_action: plan.nextAction, hardware_reason: plan.hardwareReason,
          technical_capability: plan.technicalCapability, product_coverage: plan.productCoverage,
          observed_success: plan.observedSuccess, requirement_basis: plan.requirementBasis,
          effort: payload.effort ?? null, effort_provenance: "CLIENT_REPORTED_NOT_ACTIVATION_PROOF",
          orchestrator_version: plan.version, registry_version: plan.registryVersion,
          monitoring_activated: false
        } });
      const response = ok({ plan, diagnostic_id: diagnosticId, connector_online: connectorOnline,
        installer_delivery: "PLATFORM_CHECK_REQUIRED", monitoring_activated: false });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    if (payload.action === "record_failure") {
      const { plan } = await assessAuthorizedCameraSystem(site.id, payload.family, payload.computer_available);
      await recordConnectivityOutcome({ attemptId: payload.attempt_id, siteId: site.id, family: plan.family,
        strategy: payload.strategy ?? plan.preferredStrategy, registryVersion: connectivityRegistryVersion,
        orchestratorVersion: connectionOrchestratorVersion, firmware: null,
        outcome: payload.failure === "INTEGRATION_MISSING" ? "INTEGRATION_MISSING" : "FAILED", failure: payload.failure,
        durationMs: payload.effort.elapsed_ms, interactions: payload.effort.product_actions,
        manualFields: payload.effort.technical_actions, externalAppSteps: payload.effort.external_app_actions,
        installationRequired: plan.preferredStrategy === "SOFTWARE_CONNECTOR", manualSupportRequired: payload.effort.support_required,
        stability: null, occurredAt: new Date().toISOString(), provenance: "CLIENT_REPORTED", zeroInstallVerified: false,
        commercial: { productActions: payload.effort.product_actions, technicalActions: payload.effort.technical_actions,
          installerActions: payload.effort.installer_actions, discoverySucceeded: false,
          technicalCapability: plan.technicalCapability === "PERSISTENT_PATH_VERIFIED" ? "PERSISTENT_ZERO_INSTALL"
            : plan.technicalCapability === "LOCAL_CAPABILITY_ONLY" ? "LOCAL_PATH_VERIFIED" : "UNKNOWN",
          digitalObserverCoverage: plan.productCoverage === "REMOTE_INTEGRATION_MISSING" ? "INTEGRATION_MISSING"
            : plan.productCoverage === "IDENTIFICATION_REQUIRED" ? "UNKNOWN" : "IMPLEMENTED",
          observedSuccess: "NOT_VERIFIED", requirementBasis: plan.requirementBasis === "CURRENT_SUPPORTED_PATH" ? "PRODUCT_COVERAGE"
            : plan.requirementBasis === "NO_SUITABLE_HOST" ? "TECHNICAL" : "UNKNOWN" } }, { siteId: site.id, actorId: profile.id });
      return ok({ recorded: true, activation_proof: false });
    }

    if (payload.action === "assess_new") {
      const assessment = assessCameraConnection(buildPairingConnectionAssessmentInput({
        siteId: payload.observer_site_id,
        connectorType: payload.connector_type,
        provider: payload.connector_provider,
        pairingMethod: payload.pairing_method,
        pairingPayloadKind: payload.pairing_payload_kind
      }));
      return ok({ assessment });
    }

    const result = await supabase.from("digital_observer_camera_sources")
      .select("id,observer_site_id,camera_stream_id,display_name,connector_type,connector_provider,source_mode,status,health_status,stream_protocol,gateway_provider,capabilities,last_health_check_at,last_seen_at,secret_reference,metadata")
      .eq("id", payload.camera_source_id)
      .eq("observer_site_id", payload.observer_site_id)
      .maybeSingle();
    if (result.error || !result.data) return fail("מקור המצלמה לא נמצא.", 404);

    const assessment = assessCameraConnection(buildExistingSourceAssessmentInput(result.data));
    if (payload.persist) {
      const update = await supabase.from("digital_observer_camera_sources")
        .update({
          metadata: { ...(result.data.metadata ?? {}), ...cameraConnectionMetadataForAssessment(assessment) },
          updated_at: new Date().toISOString()
        })
        .eq("id", result.data.id)
        .eq("observer_site_id", payload.observer_site_id);
      if (update.error) return fail("לא ניתן לשמור את תוצאת בדיקת החיבור.", 400);
    }

    return ok({
      assessment,
      source: {
        id: result.data.id,
        observer_site_id: result.data.observer_site_id,
        display_name: result.data.display_name,
        connector_type: result.data.connector_type,
        credential_reference_configured: Boolean(result.data.secret_reference || result.data.metadata?.credentials_server_side),
        gateway_stream_configured: Boolean(result.data.metadata?.gateway_stream_id)
      },
      persisted: payload.persist
    });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
