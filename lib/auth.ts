import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, isRole, type Permission, type UserRole } from "@/lib/roles";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { user, profile };
}

export async function requireUser(loginPath = "/login") {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) redirect(loginPath);
  return { user: session.user, profile: session.profile };
}

export async function requireRole(allowed: UserRole[], loginPath = "/login", deniedPath = "/dashboard") {
  const session = await requireUser(loginPath);
  const role = session.profile.role;
  if (!isRole(role) || !allowed.includes(role)) redirect(deniedPath);
  if (role === "manager" || role === "owner") {
    const context = await resolveManagementGardenContext(session.profile);
    if (context.available) session.profile.garden_id = context.activeGarden?.id ?? null;
  }
  if (role === "staff") {
    const context = await resolveStaffEmploymentContext(session.profile);
    if (context.available) session.profile.garden_id = context.activeEmployment?.garden_id ?? null;
  }
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireUser();
  if (!hasPermission(session.profile.role, permission)) {
    return { allowed: false, session };
  }
  return { allowed: true, session };
}

export function dashboardPathForRole(role: UserRole) {
  return {
    admin: "/dashboard/admin",
    network_manager: "/dashboard/admin/enterprise",
    inspector: "/dashboard/inspector/control-center",
    manager: "/dashboard/garden",
    owner: "/dashboard/garden",
    staff: "/dashboard/staff",
    parent: "/dashboard/parent/family-home"
  }[role];
}

export async function dashboardPathForProfile(profile: { id?: string | null; role?: string | null; garden_id?: string | null; active?: boolean | null }) {
  if (!isRole(profile.role)) return "/dashboard";
  if ((profile.role === "manager" || profile.role === "owner") && profile.id) {
    const context = await resolveManagementGardenContext({ id: profile.id, garden_id: profile.garden_id });
    if (context.available) profile.garden_id = context.activeGarden?.id ?? null;
  }
  if ((profile.role === "manager" || profile.role === "owner") && !profile.garden_id) {
    return "/onboarding/kindergarten";
  }
  if ((profile.role === "manager" || profile.role === "owner") && profile.garden_id) {
    const supabase = await createClient();
    const { data: garden } = await supabase
      .from("gardens" as any)
      .select("approval_flow_status")
      .eq("id", profile.garden_id)
      .maybeSingle();
    const status = String(garden?.approval_flow_status ?? "");
    if (["admin_approved", "credentials_sent", "activation_in_progress", "payment_pending", "onboarding_in_progress", "correction_required", "onboarding_submitted", "pending_final_approval"].includes(status)) {
      return "/onboarding/kindergarten";
    }
  }
  if (profile.role === "parent") {
    const supabase = await createClient();
    const { data: parent } = await supabase
      .from("parents" as any)
      .select("id, status, completed_profile, onboarding_status")
      .or(`profile_id.eq.${profile.id},user_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!parent) return "/dashboard/parent";
    if (parent && (parent.completed_profile !== true || parent.onboarding_status !== "active")) {
      return "/parent-onboarding";
    }
  }
  if (profile.role === "staff") {
    const context = await resolveStaffEmploymentContext({ id: profile.id ?? "", garden_id: profile.garden_id });
    if (context.available && context.employments.length) return "/dashboard/staff";
    return "/dashboard/staff/job-market";
  }
  if (profile.role === "inspector" && profile.id) {
    const supabase = await createClient();
    const { data: application } = await supabase.from("inspector_applications" as any)
      .select("status").eq("profile_id", profile.id).maybeSingle();
    if (profile.active === false || application?.status !== "approved") return "/dashboard/inspector/apply";
  }
  return dashboardPathForRole(profile.role);
}
