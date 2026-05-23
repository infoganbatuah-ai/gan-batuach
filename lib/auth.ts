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
  return session as NonNullable<typeof session>;
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
    inspector: "/dashboard/inspector",
    manager: "/dashboard/garden",
    staff: "/dashboard/staff",
    parent: "/dashboard/parent"
  }[role];
}
