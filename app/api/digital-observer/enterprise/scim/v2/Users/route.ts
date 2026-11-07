/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 41 tables precede generated Supabase types. */
import crypto from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { evaluateScimOperation, hashEnterpriseCredential, type EnterpriseRole } from "@/lib/domain/digital-observer/enterprise-identity";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  operation: z.enum(["create_user", "update_membership", "suspend_user", "deprovision_user"]),
  event_id: z.string().min(8).max(200),
  external_id: z.string().min(1).max(300),
  profile_id: z.string().uuid(),
  group: z.string().min(1).max(160),
  site_ids: z.array(z.string().uuid()).max(1000).default([])
}).strict();

function pepper() {
  const value = process.env.DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER;
  if (!value || value.length < 16) throw new Error("ENTERPRISE_CREDENTIAL_PEPPER_REQUIRED");
  return value;
}

function scimError(error: unknown) {
  const message = error instanceof Error ? error.message : "SCIM_OPERATION_FAILED";
  if (/AUTH|DENIED|MISMATCH|UNTRUSTED/.test(message)) return fail(message, 403);
  if (/REQUIRED|INVALID|UNAVAILABLE/.test(message)) return fail(message, 409);
  return null;
}

export async function POST(request: Request) {
  try {
    if (!isAdminClientConfigured()) return fail("SCIM is unavailable.", 503);
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer doscim_")) return fail("SCIM authentication is required.", 401);
    const rawCredential = authorization.slice("Bearer ".length).trim();
    const credentialHash = hashEnterpriseCredential(rawCredential, pepper());
    const input = schema.parse(await request.json());
    const admin = createAdminClient() as any;
    const connection = await admin.from("digital_observer_scim_connections")
      .select("id,organization_id,status,provider_mode,credential_expires_at,group_role_mapping,revoked_at")
      .eq("credential_hash", credentialHash).eq("provider_mode", "sandbox").eq("status", "configured").is("revoked_at", null).maybeSingle();
    if (connection.error || !connection.data || !connection.data.credential_expires_at
      || new Date(connection.data.credential_expires_at).getTime() <= Date.now()) return fail("SCIM credential is invalid or expired.", 401);
    const existingReceipt = await admin.from("digital_observer_scim_event_receipts").select("id,result_status")
      .eq("scim_connection_id", connection.data.id).eq("provider_event_id", input.event_id).maybeSingle();
    if (existingReceipt.data) return ok({ duplicate: true, accepted: existingReceipt.data.result_status === "accepted" });
    const externalSubjectHash = crypto.createHmac("sha256", pepper()).update(input.external_id).digest("hex");
    const mappedRole = connection.data.group_role_mapping?.[input.group] as EnterpriseRole | undefined;
    const decision = evaluateScimOperation({ operation: input.operation, connectionActive: true, organizationMatches: true,
      claimTrusted: Boolean(mappedRole), requestedRole: mappedRole, mappedRole });
    if (!decision.allowed || !mappedRole) throw new Error(`SCIM_ROLE_MAPPING_DENIED:${decision.reason}`);
    const [profile, sites] = await Promise.all([
      admin.from("profiles").select("id,active").eq("id", input.profile_id).eq("active", true).maybeSingle(),
      input.site_ids.length ? admin.from("observer_sites").select("id").eq("digital_observer_organization_id", connection.data.organization_id)
        .is("garden_id", null).neq("site_type", "kindergarten").in("id", input.site_ids) : Promise.resolve({ data: [], error: null })
    ]);
    if (profile.error || !profile.data) throw new Error("SCIM_PROFILE_UNAVAILABLE");
    if (sites.error || (sites.data ?? []).length !== input.site_ids.length) throw new Error("SCIM_SITE_SCOPE_DENIED");
    const deprovision = input.operation === "deprovision_user";
    const suspend = input.operation === "suspend_user";
    const status = deprovision ? "deprovisioned" : suspend ? "suspended" : "active";
    const subject = await admin.from("digital_observer_scim_subjects").upsert({
      scim_connection_id: connection.data.id, organization_id: connection.data.organization_id,
      external_subject_hash: externalSubjectHash, profile_id: input.profile_id, enterprise_role: mappedRole,
      site_scope: input.site_ids, subject_status: status, last_provider_event_id: input.event_id,
      suspended_at: suspend ? new Date().toISOString() : null, deprovisioned_at: deprovision ? new Date().toISOString() : null
    }, { onConflict: "scim_connection_id,external_subject_hash" }).select("id").single();
    if (subject.error) throw new Error(`SCIM_SUBJECT_WRITE_FAILED:${subject.error.code ?? "unknown"}`);
    const membership = await admin.from("digital_observer_organization_memberships").upsert({
      organization_id: connection.data.organization_id, profile_id: input.profile_id, enterprise_role: mappedRole,
      active: !deprovision && !suspend, all_sites: input.site_ids.length === 0, revoked_at: deprovision || suspend ? new Date().toISOString() : null,
      revoked_reason: deprovision ? "scim_deprovision" : suspend ? "scim_suspension" : null, accepted_at: new Date().toISOString(),
      metadata: { source: "scim", connection_id: connection.data.id }
    }, { onConflict: "organization_id,profile_id" }).select("id").single();
    if (membership.error) throw new Error(`SCIM_MEMBERSHIP_WRITE_FAILED:${membership.error.code ?? "unknown"}`);
    const cleared = await admin.from("digital_observer_organization_member_sites").delete().eq("membership_id", membership.data.id);
    if (cleared.error) throw new Error(`SCIM_SITE_SCOPE_CLEAR_FAILED:${cleared.error.code ?? "unknown"}`);
    if (!deprovision && !suspend && input.site_ids.length) {
      const scoped = await admin.from("digital_observer_organization_member_sites").insert(input.site_ids.map((siteId) => ({ membership_id: membership.data.id, observer_site_id: siteId })));
      if (scoped.error) throw new Error(`SCIM_SITE_SCOPE_WRITE_FAILED:${scoped.error.code ?? "unknown"}`);
    }
    const receipt = await admin.from("digital_observer_scim_event_receipts").insert({
      scim_connection_id: connection.data.id, provider_event_id: input.event_id, operation: input.operation,
      result_status: "accepted", external_subject_hash: externalSubjectHash
    });
    if (receipt.error) throw new Error(`SCIM_RECEIPT_WRITE_FAILED:${receipt.error.code ?? "unknown"}`);
    const audited = await admin.from("digital_observer_enterprise_audit_events").insert({
      organization_id: connection.data.organization_id, scim_connection_id: connection.data.id, resource_type: "organization_membership",
      resource_id: membership.data.id, action: `scim.${input.operation}`, authorization_decision: "allowed", result_status: "success",
      correlation_id: input.event_id, safe_metadata: { role: mappedRole, site_count: input.site_ids.length, status }
    });
    if (audited.error) throw new Error(`SCIM_AUDIT_WRITE_FAILED:${audited.error.code ?? "unknown"}`);
    await admin.from("digital_observer_scim_connections").update({ last_used_at: new Date().toISOString() }).eq("id", connection.data.id);
    return ok({ id: subject.data.id, active: !deprovision && !suspend, role: mappedRole, duplicate: false }, 201);
  } catch (error) { return scimError(error) ?? handleRouteError(error); }
}
