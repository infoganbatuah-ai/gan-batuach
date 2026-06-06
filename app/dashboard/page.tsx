import { redirect } from "next/navigation";
import { dashboardPathForProfile, requireUser } from "@/lib/auth";
import { isRole } from "@/lib/roles";

export default async function DashboardIndex() {
  const { profile } = await requireUser();
  redirect(isRole(profile.role) ? await dashboardPathForProfile(profile) : "/login");
}
