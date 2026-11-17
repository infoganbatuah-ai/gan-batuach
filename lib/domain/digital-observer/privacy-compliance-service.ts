/* eslint-disable @typescript-eslint/no-explicit-any -- additive PUSH 45 tables precede generated Supabase types. */
import "server-only";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { evaluatePrivacyGate, type PrivacyContext, type SensitiveCapability } from "./privacy-compliance";

type DbClient = SupabaseClient<Database>;

function fail(error: unknown, prefix: string): never {
  const code = (error as { code?: string } | null)?.code ?? "unknown";
  throw new Error(`${prefix}:${code}`);
}

export async function loadPrivacyComplianceState(db: DbClient, siteId: string, profileId: string) {
  const client = db as any;
  const [profiles, approvals, notices, acknowledgements, requests, holds, incidents] = await Promise.all([
    client.from("digital_observer_privacy_policy_profiles").select("id,policy_key,policy_version,product_context,jurisdiction,stated_purpose,data_categories,area_restrictions,retention_schedule,notice_version,legal_decision_state,active,updated_at").eq("observer_site_id", siteId).order("policy_version", { ascending: false }).limit(20),
    client.from("digital_observer_legal_approvals").select("id,privacy_policy_profile_id,sensitive_capability,jurisdiction,stated_purpose,approval_status,effective_at,expires_at,revoked_at,reviewer_class,updated_at").order("updated_at", { ascending: false }).limit(100),
    client.from("digital_observer_notice_versions").select("id,notice_key,version,product_context,jurisdiction,locale,document_reference,status,effective_at").eq("status", "approved").limit(50),
    client.from("digital_observer_notice_acknowledgements").select("id,notice_version_id,acknowledgement_status,displayed_at,acknowledged_at,withdrawn_at").eq("observer_site_id", siteId).eq("profile_id", profileId).limit(50),
    client.from("privacy_rights_requests").select("id,request_key,request_type,status,stated_purpose,execution_status,notification_status,external_system_disposition,created_at,updated_at").eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(50),
    client.from("legal_holds").select("id,hold_key,hold_reason,hold_type,status,jurisdiction,documented_purpose,data_scope,start_date,end_date,review_due_at,released_at,created_at").eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(50),
    client.from("digital_observer_privacy_incidents").select("id,incident_key,classification,severity,status,containment_status,notification_decision,safe_summary,created_at,closed_at").eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(50)
  ]);
  const result = [profiles, approvals, notices, acknowledgements, requests, holds, incidents].find((item) => item.error);
  if (result?.error) fail(result.error, "PRIVACY_STATE_UNAVAILABLE");
  return {
    profiles: profiles.data ?? [], approvals: approvals.data ?? [], notices: notices.data ?? [],
    acknowledgements: acknowledgements.data ?? [], requests: requests.data ?? [], holds: holds.data ?? [], incidents: incidents.data ?? [],
    externalLegalApproval: "PENDING",
    sensitiveActivation: "DENIED_UNTIL_SCOPED_WRITTEN_APPROVAL"
  };
}

export async function submitPrivacyRightsRequest(db: DbClient, input: {
  siteId: string; organizationId?: string | null; profileId: string; requestType: string; purpose: string;
}) {
  const requestKey = `do-pr-${crypto.randomUUID()}`;
  const { data, error } = await (db as any).from("privacy_rights_requests").insert({
    request_key: requestKey,
    requester_profile_id: input.profileId,
    requested_by: input.profileId,
    subject_user_id: input.profileId,
    data_subject_type: "observer_account",
    subject_type: "observer_account",
    data_subject_id: input.profileId,
    request_type: input.requestType,
    status: "submitted",
    execution_status: "not_started",
    observer_site_id: input.siteId,
    organization_id: input.organizationId ?? null,
    stated_purpose: input.purpose,
    request_reason: input.purpose,
    metadata: { product: "digital_observer", push: 45 }
  }).select("id,request_key,request_type,status,execution_status,created_at").single();
  if (error) fail(error, "PRIVACY_REQUEST_FAILED");
  return data;
}

export async function acknowledgePrivacyNotice(db: DbClient, input: {
  siteId: string; profileId: string; noticeVersionId: string; displayProofHash: string; displayedAt: string;
}) {
  const { data, error } = await (db as any).from("digital_observer_notice_acknowledgements").upsert({
    notice_version_id: input.noticeVersionId,
    observer_site_id: input.siteId,
    profile_id: input.profileId,
    acknowledgement_status: "acknowledged",
    displayed_at: input.displayedAt,
    acknowledged_at: new Date().toISOString(),
    withdrawn_at: null,
    display_proof_hash: input.displayProofHash
  }, { onConflict: "notice_version_id,observer_site_id,profile_id" }).select("id,acknowledgement_status,acknowledged_at").single();
  if (error) fail(error, "NOTICE_ACKNOWLEDGEMENT_FAILED");
  return data;
}

export async function createLegalHold(admin: DbClient, input: {
  siteId: string; organizationId?: string | null; profileId: string; holdType: string; purpose: string; dataScope: string[]; reviewDueAt: string;
}) {
  const holdKey = `do-hold-${crypto.randomUUID()}`;
  const { data, error } = await (admin as any).from("legal_holds").insert({
    hold_key: holdKey,
    hold_reason: input.purpose,
    hold_type: input.holdType,
    status: "active",
    observer_site_id: input.siteId,
    organization_id: input.organizationId ?? null,
    documented_purpose: input.purpose,
    data_scope: input.dataScope,
    review_due_at: input.reviewDueAt,
    created_by: input.profileId,
    metadata: { product: "digital_observer", push: 45, unrestricted_access: false }
  }).select("id,hold_key,hold_type,status,review_due_at,created_at").single();
  if (error) fail(error, "LEGAL_HOLD_CREATE_FAILED");
  return data;
}

export async function releaseLegalHold(admin: DbClient, input: {
  siteId: string; organizationId?: string | null; profileId: string; holdId: string; reason: string;
}) {
  const client = admin as any;
  const { data: current, error: lookupError } = await client.from("legal_holds")
    .select("id,status,observer_site_id").eq("id", input.holdId).eq("observer_site_id", input.siteId).maybeSingle();
  if (lookupError) fail(lookupError, "LEGAL_HOLD_LOOKUP_FAILED");
  if (!current) throw new Error("LEGAL_HOLD_SCOPE_DENIED");
  if (current.status !== "active" && current.status !== "pending_release") throw new Error("LEGAL_HOLD_RELEASE_DENIED");

  const releasedAt = new Date().toISOString();
  const { data, error } = await client.from("legal_holds").update({
    status: "released",
    release_requested_by: input.profileId,
    release_approved_by: input.profileId,
    released_at: releasedAt,
    end_date: releasedAt,
    release_reason: input.reason,
    updated_at: releasedAt
  }).eq("id", input.holdId).eq("observer_site_id", input.siteId)
    .in("status", ["active", "pending_release"])
    .select("id,hold_key,status,released_at,release_reason").single();
  if (error) fail(error, "LEGAL_HOLD_RELEASE_FAILED");
  await appendPrivacyAudit(admin, {
    profileId: input.profileId, siteId: input.siteId, organizationId: input.organizationId,
    resourceType: "legal_hold", resourceId: input.holdId, action: "release", decision: "allowed", result: "success"
  });
  return data;
}

export async function reportPrivacyIncident(admin: DbClient, input: {
  siteId: string; organizationId?: string | null; profileId: string; classification: string; severity: string; safeSummary: string;
}) {
  const incidentKey = `do-privacy-incident-${crypto.randomUUID()}`;
  const correlationId = crypto.randomUUID();
  const { data, error } = await (admin as any).from("digital_observer_privacy_incidents").insert({
    incident_key: incidentKey,
    observer_site_id: input.siteId,
    organization_id: input.organizationId ?? null,
    classification: input.classification,
    severity: input.severity,
    reported_by: input.profileId,
    correlation_id: correlationId,
    notification_decision: "pending_legal_review",
    safe_summary: input.safeSummary
  }).select("id,incident_key,status,notification_decision,created_at").single();
  if (error) fail(error, "PRIVACY_INCIDENT_CREATE_FAILED");
  await appendPrivacyAudit(admin, { profileId: input.profileId, siteId: input.siteId, organizationId: input.organizationId,
    resourceType: "privacy_incident", resourceId: data.id, action: "report", decision: "allowed", result: "success", correlationId });
  return data;
}

export async function evaluateStoredPrivacyApproval(db: DbClient, input: {
  siteId: string; tenantId: string; capability: SensitiveCapability; context: PrivacyContext; purpose: string; humanReviewerId?: string | null;
}) {
  const client = db as any;
  const { data: profile, error: profileError } = await client.from("digital_observer_privacy_policy_profiles")
    .select("id,active,legal_decision_state,stated_purpose").eq("observer_site_id", input.siteId)
    .eq("product_context", input.context).eq("stated_purpose", input.purpose).order("policy_version", { ascending: false }).limit(1).maybeSingle();
  if (profileError) fail(profileError, "PRIVACY_PROFILE_LOOKUP_FAILED");
  const { data: approval, error: approvalError } = profile ? await client.from("digital_observer_legal_approvals")
    .select("approval_status,stated_purpose,effective_at,expires_at,revoked_at").eq("privacy_policy_profile_id", profile.id)
    .eq("sensitive_capability", input.capability).eq("stated_purpose", input.purpose).limit(1).maybeSingle() : { data: null, error: null };
  if (approvalError) fail(approvalError, "LEGAL_APPROVAL_LOOKUP_FAILED");
  return evaluatePrivacyGate({
    capability: input.capability,
    context: input.context,
    purpose: input.purpose,
    tenantId: input.tenantId,
    siteId: input.siteId,
    policyActive: profile?.active === true,
    decisionState: profile?.legal_decision_state ?? null,
    approvalScopeMatches: approval?.approval_status === "approved" && approval?.revoked_at == null && approval?.stated_purpose === input.purpose,
    approvalExpiresAt: approval?.expires_at ?? null,
    humanReviewRequired: true,
    humanReviewerId: input.humanReviewerId
  });
}

async function appendPrivacyAudit(admin: DbClient, input: {
  profileId: string; siteId: string; organizationId?: string | null; resourceType: string; resourceId?: string | null;
  action: string; decision: "allowed" | "denied" | "review_required"; result: "success" | "denied" | "failed" | "pending"; correlationId?: string;
}) {
  const { error } = await (admin as any).from("digital_observer_privacy_audit_events").insert({
    actor_profile_id: input.profileId,
    observer_site_id: input.siteId,
    organization_id: input.organizationId ?? null,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    action: input.action,
    authorization_decision: input.decision,
    result_status: input.result,
    correlation_id: input.correlationId ?? crypto.randomUUID(),
    safe_metadata: { push: 45 }
  });
  if (error) fail(error, "PRIVACY_AUDIT_FAILED");
}
