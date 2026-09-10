import { redirect } from "next/navigation";
import { fail } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import type { UserRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { managementContactVerification } from "@/lib/management/contact-verification";

type OperationalDenial = "session" | "role" | "inactive" | "contact_verification" | "staff_record" | "staff_employment" | "inspector_approval" | "inspector_assignment" | "authority_unavailable";
type QueryResult<T> = { data: T | null; error: unknown };
type StaffActivation = { id: string; approved_to_work: boolean | null; onboarding_status: string | null };
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
      if (!profile.garden_id) return denied("role");
      const authority = await supabase.rpc("can_manage_garden", { target_garden_id: profile.garden_id });
      if (authority.error) return denied("authority_unavailable", 503);
      if (authority.data !== true) return denied("role");
      return { allowed: true as const, session, gardenIds: [profile.garden_id] };
    }
    if (profile.role !== "staff" && profile.role !== "inspector") {
      return { allowed: true as const, session };
    }

    if (profile.role === "staff") {
      if (!profile.garden_id) return denied("staff_employment");
      const staff = await supabase
        .from("staff" as never)
        .select("id, garden_id, approved_to_work, onboarding_status")
        .eq("profile_id", profile.id)
        .eq("garden_id", profile.garden_id)
        .maybeSingle() as unknown as QueryResult<StaffActivation>;
      if (staff.error) return denied("authority_unavailable", 503);
      if (!staff.data || staff.data.approved_to_work !== true || staff.data.onboarding_status !== "active") {
        return denied("staff_record");
      }
      const employment = await supabase
        .from("staff_kindergarten_employments" as never)
        .select("id")
        .eq("profile_id", profile.id)
        .eq("staff_id", staff.data.id)
        .eq("garden_id", profile.garden_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle() as unknown as QueryResult<IdRow>;
      if (employment.error) return denied("authority_unavailable", 503);
      if (!employment.data) return denied("staff_employment");
      return { allowed: true as const, session, gardenIds: [profile.garden_id] };
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
    return { allowed: true as const, session, gardenIds: [assignment.data.id] };
  } catch {
    return denied("authority_unavailable", 503);
  }
}

export async function requireOperationalRole(allowedRoles: UserRole[]) {
  const access = await getOperationalRoleContext(allowedRoles);
  if (access.allowed) return access.session;
  if (access.reason === "session") redirect("/login");
  if (access.reason === "contact_verification") redirect("/app/verify-contact");
  const session = await getSessionProfile().catch(() => ({ user: null, profile: null }));
  if (session.profile?.role === "staff" && access.reason === "staff_employment") redirect("/dashboard/staff/access-pending");
  if (session.profile?.role === "staff") redirect("/onboarding/staff");
  if (session.profile?.role === "inspector") redirect("/dashboard/inspector/apply");
  redirect("/dashboard");
}
