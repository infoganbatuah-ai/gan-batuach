import { redirect } from "next/navigation";
import { dashboardPathForProfile, requireUser } from "@/lib/auth";
import { isRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardIndex() {
  const { profile, user } = await requireUser();
  if (user.user_metadata?.product === "digital_observer") redirect("/digital-observer/dashboard");
  const supabase = await createClient();
  const [account, site, membership] = await Promise.all([
    supabase.from("digital_observer_accounts" as any).select("profile_id").eq("profile_id", user.id).maybeSingle(),
    supabase.from("observer_sites" as any).select("id").eq("owner_profile_id", user.id).is("garden_id", null).neq("site_type", "kindergarten").limit(1).maybeSingle(),
    supabase.from("observer_site_memberships" as any).select("observer_site_id").eq("profile_id", user.id).eq("active", true).limit(1).maybeSingle()
  ]);
  if (account.data || site.data || membership.data) redirect("/digital-observer/dashboard");
  redirect(isRole(profile.role) ? await dashboardPathForProfile(profile) : "/login");
}
