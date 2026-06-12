import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, isRole, type Permission, type UserRole } from "@/lib/roles";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { user, profile };
}

export async function requireUser() {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) redirect("/login");
  return { user: session.user, profile: session.profile };
}

export async function requireRole(allowed: UserRole[]) {
  const session = await requireUser();
  const role = session.profile.role;
  if (!isRole(role) || !allowed.includes(role)) redirect("/dashboard");
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

export async function dashboardPathForProfile(profile: { id?: string | null; role?: string | null; garden_id?: string | null }) {
  if (!isRole(profile.role)) return "/dashboard";
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
    if (parent && (parent.completed_profile !== true || parent.onboarding_status !== "active")) {
      return "/parent-onboarding";
    }
  }
  if (profile.role === "staff") {
    const supabase = await createClient();
    const { data: staff } = await supabase
      .from("staff" as any)
      .select("id, approved_to_work, onboarding_status")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (staff && (staff.approved_to_work !== true || staff.onboarding_status !== "active")) {
      return "/onboarding/staff";
    }
  }
  return dashboardPathForRole(profile.role);
}
