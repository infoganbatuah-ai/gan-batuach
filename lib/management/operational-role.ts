import { redirect } from "next/navigation";
import { fail } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import type { UserRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";

type OperationalDenial = "session" | "role" | "inactive" | "contact_verification" | "staff_record" | "staff_employment" | "inspector_approval" | "inspector_assignment" | "authority_unavailable";
type QueryResult<T> = { data: T | null; error: unknown };
type InspectorApplication = { id: string; status: string; activated_at: string | null };
type IdRow = { id: string };

function denied(reason: OperationalDenial, status: 401 | 403 | 503 = 403) {
  const message = status === 401
    ? "נדרשת התחברות מחדש."
    : status === 503
      ? "בדיקת ההרשאה התפעולית אינה זמינה כרגע."
      : "החשבון עדיין אינו מורשה לפעילות תפעולית.";
  return { allowed: false as const, reason, response: fail(message, status) };
}

/**
 * Distinguishes a role label from an activated operational identity.
 * Candidate-facing onboarding/application routes intentionally keep using
 * requireRole; internal Management routes use this guard instead.
 */
export async function getOperationalRoleContext(allowedRoles: UserRole[]) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile || session.user.id !== session.profile.id) {
      return denied("session", 401);
    }

    const { profile } = session;
    if (!allowedRoles.includes(profile.role as UserRole)) return denied("role");
    if (profile.active !== true) return denied("inactive");
    if (!managementContactVerification(session.user, profile).complete) return denied("contact_verification");
    const supabase = await createClient();
    if (profile.role === "manager" || profile.role === "owner") {
      const gardenContext = await resolveManagementGardenContext(profile);
      if (!gardenContext.available) return denied("authority_unavailable", 503);
      const gardenId = gardenContext.activeGarden?.id;
      if (!gardenId) return denied("role");
      const authority = await supabase.rpc("can_manage_garden", { target_garden_id: gardenId });
      if (authority.error) return denied("authority_unavailable", 503);
      if (authority.data !== true) return denied("role");
      session.profile.garden_id = gardenId;
      return { allowed: true as const, session, gardenIds: [gardenId], employment: null };
    }
    if (profile.role !== "staff" && profile.role !== "inspector") {
      return { allowed: true as const, session, employment: null };
    }

    if (profile.role === "staff") {
      const context = await resolveStaffEmploymentContext(profile);
      if (!context.available) return denied("authority_unavailable", 503);
      const employment = context.activeEmployment;
      if (!employment) return denied("staff_employment");
      const authority = await supabase.rpc("can_staff_access_garden", { target_garden_id: employment.garden_id });
      if (authority.error) return denied("authority_unavailable", 503);
      if (authority.data !== true) return denied("staff_employment");
      session.profile.garden_id = employment.garden_id;
      return { allowed: true as const, session, gardenIds: [employment.garden_id], employment };
    }

    const [application, inspector, assignment] = await Promise.all([
      supabase.from("inspector_applications" as never).select("id, status, activated_at").eq("profile_id", profile.id).maybeSingle(),
      supabase.from("inspectors" as never).select("id").eq("id", profile.id).maybeSingle(),
      supabase.from("gardens" as never).select("id").eq("inspector_id", profile.id).limit(1).maybeSingle()
    ]) as unknown as [QueryResult<InspectorApplication>, QueryResult<IdRow>, QueryResult<IdRow>];
    if (application.error || inspector.error || assignment.error) return denied("authority_unavailable", 503);
    if (!application.data || application.data.status !== "approved" || !application.data.activated_at || !inspector.data) {
      return denied("inspector_approval");
    }
    if (!assignment.data) return denied("inspector_assignment");
    return { allowed: true as const, session, gardenIds: [assignment.data.id], employment: null };
  } catch {
    return denied("authority_unavailable", 503);
  }
}

export async function requireOperationalRole(allowedRoles: UserRole[]) {
  const access = await getOperationalRoleContext(allowedRoles);
  if (access.allowed) return { ...access.session, employment: access.employment };
  if (access.reason === "session") redirect("/login");
  if (access.reason === "contact_verification") redirect("/app/verify-contact");
  const session = await getSessionProfile().catch(() => ({ user: null, profile: null }));
  if (session.profile?.role === "staff" && access.reason === "staff_employment") redirect("/dashboard/staff/job-market");
  if (session.profile?.role === "staff") redirect("/onboarding/staff");
  if (session.profile?.role === "inspector") redirect("/dashboard/inspector/apply");
  redirect("/dashboard");
}

/** Platform approval allows the Inspector shell; Garden data still needs assignment. */
export async function requireApprovedInspector() {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) redirect("/login");
  if (session.profile.role !== "inspector") redirect("/dashboard");
  if (session.profile.active !== true) redirect("/dashboard/inspector/apply");
  if (!managementContactVerification(session.user, session.profile).complete) redirect("/app/verify-contact");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_inspector_approved" as never);
  if (error || data !== true) redirect("/dashboard/inspector/apply");
  return session;
}
