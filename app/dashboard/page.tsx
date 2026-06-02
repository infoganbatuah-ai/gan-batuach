import { redirect } from "next/navigation";
import { dashboardPathForRole, requireUser } from "@/lib/auth";
import { isRole } from "@/lib/roles";

export default async function DashboardIndex() {
  const { profile } = await requireUser();
  redirect(isRole(profile.role) ? dashboardPathForRole(profile.role) : "/login");
}
