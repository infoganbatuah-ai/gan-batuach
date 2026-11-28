import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { privacyContexts, sensitiveCapabilities } from "@/lib/domain/digital-observer/privacy-compliance";
import {
  acknowledgePrivacyNotice,
  createLegalHold,
  evaluateStoredPrivacyApproval,
  loadPrivacyComplianceState,
  releaseLegalHold,
  reportPrivacyIncident,
  submitPrivacyRightsRequest
} from "@/lib/domain/digital-observer/privacy-compliance-service";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const siteId = z.string().uuid();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit_rights_request"), site_id: siteId,
    request_type: z.enum(["access", "correction", "deletion", "export", "restriction", "objection", "anonymization"]),
    purpose: z.string().trim().min(5).max(500) }).strict(),
  z.object({ action: z.literal("acknowledge_notice"), site_id: siteId, notice_version_id: z.string().uuid(),
    displayed_at: z.string().datetime(), display_proof_hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ action: z.literal("create_legal_hold"), site_id: siteId,
    hold_type: z.enum(["incident_investigation", "regulatory_review", "audit_preservation", "data_subject_request", "authorized_investigation", "privacy_incident"]),
    purpose: z.string().trim().min(10).max(1000), data_scope: z.array(z.string().trim().min(2).max(80)).min(1).max(50),
    review_due_at: z.string().datetime() }).strict(),
  z.object({ action: z.literal("release_legal_hold"), site_id: siteId, hold_id: z.string().uuid(),
    reason: z.string().trim().min(10).max(1000) }).strict(),
  z.object({ action: z.literal("report_incident"), site_id: siteId,
    classification: z.enum(["confidentiality", "integrity", "availability", "unauthorized_access", "retention_failure", "misdirected_notification", "supplier_incident", "suspected_breach"]),
    severity: z.enum(["low", "medium", "high", "critical"]), safe_summary: z.string().trim().min(10).max(1000) }).strict(),
  z.object({ action: z.literal("evaluate_sensitive_activation"), site_id: siteId,
    capability: z.enum(sensitiveCapabilities), context: z.enum(privacyContexts), purpose: z.string().trim().min(5).max(500),
    human_reviewer_id: z.string().uuid().nullable().optional() }).strict()
]);

function responseFor(error: unknown) {
  const message = error instanceof Error ? error.message : "PRIVACY_OPERATION_FAILED";
  if (/DENIED|UNAUTHORIZED|SCOPE_REQUIRED/.test(message)) return fail(message, 403);
  if (/UNAVAILABLE/.test(message)) return fail(message, 503);
  return null;
}

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const requestedSite = new URL(request.url).searchParams.get("site_id");
    if (!requestedSite || !siteId.safeParse(requestedSite).success) return fail("A valid Site is required.", 400);
    const site = await getObserverSiteAccess(session.supabase, session.profile, requestedSite);
    if (!site) return fail("Site access is denied.", 403);
    return ok({
      ...(await loadPrivacyComplianceState(session.supabase, requestedSite, session.profile.id)),
      site: { id: site.id, name: site.name, site_type: site.site_type },
      guarantees: {
        consent_is_not_legal_approval: true,
        unrestricted_media_links: false,
        external_deletion_claim_without_confirmation: false,
        child_biometrics_enabled: false
      }
    });
  } catch (error) { return responseFor(error) ?? handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const input = schema.parse(await request.json());
    const manage = input.action === "create_legal_hold" || input.action === "release_legal_hold" || input.action === "report_incident";
    const site = await getObserverSiteAccess(session.supabase, session.profile, input.site_id, { manage });
    if (!site) return fail("Site access is denied.", 403);
    const organizationId = (site as { digital_observer_organization_id?: string | null }).digital_observer_organization_id ?? null;

    if (input.action === "submit_rights_request") return ok(await submitPrivacyRightsRequest(session.supabase, {
      siteId: input.site_id, organizationId, profileId: session.profile.id, requestType: input.request_type, purpose: input.purpose
    }), 201);
    if (input.action === "acknowledge_notice") return ok(await acknowledgePrivacyNotice(session.supabase, {
      siteId: input.site_id, profileId: session.profile.id, noticeVersionId: input.notice_version_id,
      displayProofHash: input.display_proof_hash, displayedAt: input.displayed_at
    }));
    if (input.action === "evaluate_sensitive_activation") return ok(await evaluateStoredPrivacyApproval(session.supabase, {
      siteId: input.site_id, tenantId: organizationId ?? input.site_id, capability: input.capability, context: input.context,
      purpose: input.purpose, humanReviewerId: input.human_reviewer_id
    }));

    if (!isAdminClientConfigured()) return fail("The privacy control service is not configured.", 503);
    const admin = createAdminClient();
    if (input.action === "create_legal_hold") return ok(await createLegalHold(admin, {
      siteId: input.site_id, organizationId, profileId: session.profile.id, holdType: input.hold_type,
      purpose: input.purpose, dataScope: input.data_scope, reviewDueAt: input.review_due_at
    }), 201);
    if (input.action === "release_legal_hold") return ok(await releaseLegalHold(admin, {
      siteId: input.site_id, organizationId, profileId: session.profile.id, holdId: input.hold_id, reason: input.reason
    }));
    return ok(await reportPrivacyIncident(admin, {
      siteId: input.site_id, organizationId, profileId: session.profile.id,
      classification: input.classification, severity: input.severity, safeSummary: input.safe_summary
    }), 201);
  } catch (error) { return responseFor(error) ?? handleRouteError(error); }
}
