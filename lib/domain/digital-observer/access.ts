import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ObserverAccessProfile = {
  id: string;
  role?: string | null;
};

export async function getObserverSiteAccess(
  supabase: SupabaseClient,
  profile: ObserverAccessProfile,
  observerSiteId: string,
  options: { manage?: boolean; billing?: boolean } = {}
) {
  const { data: site } = await supabase
    .from("observer_sites" as any)
    .select("id,name,site_type,owner_profile_id,garden_id,monitoring_enabled,metadata")
    .eq("id", observerSiteId)
    .maybeSingle();

  if (!site || site.site_type === "kindergarten" || site.garden_id) return null;
  if (profile.role === "admin" || site.owner_profile_id === profile.id) return site;

  const allowedRoles = options.billing
    ? ["owner", "admin", "billing"]
    : options.manage
      ? ["owner", "admin", "operator"]
      : ["owner", "admin", "operator", "viewer", "billing"];
  const { data: membership } = await supabase
    .from("observer_site_memberships" as any)
    .select("id,member_role")
    .eq("observer_site_id", observerSiteId)
    .eq("profile_id", profile.id)
    .eq("active", true)
    .in("member_role", allowedRoles)
    .maybeSingle();

  return membership ? site : null;
}

export function safeObserverReturnPath(value?: string | null) {
  if (!value || !value.startsWith("/digital-observer") || value.startsWith("//")) {
    return "/digital-observer/dashboard";
  }
  return value;
}

export async function requireDigitalObserverUser(loginPath = "/digital-observer/login") {
  const session = await requireUser(loginPath);
  const supabase = await createClient();
  const [account, ownedSite, membership] = await Promise.all([
    supabase.from("digital_observer_accounts" as any).select("profile_id,account_type,status,onboarding_step,trial_start,trial_end").eq("profile_id", session.user.id).maybeSingle(),
    supabase.from("observer_sites" as any).select("id").eq("owner_profile_id", session.user.id).is("garden_id", null).neq("site_type", "kindergarten").limit(1).maybeSingle(),
    supabase.from("observer_site_memberships" as any).select("observer_site_id").eq("profile_id", session.user.id).eq("active", true).limit(1).maybeSingle()
  ]);
  const isObserver = session.user.user_metadata?.product === "digital_observer"
    || Boolean(account.data || ownedSite.data || membership.data)
    || session.profile.role === "admin";
  if (!isObserver) redirect("/digital-observer/login?error=not_observer_account");
  return { ...session, observerAccount: account.data ?? null };
}

export async function getDigitalObserverApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn("Digital Observer API session rejected", {
      reason: "missing_authenticated_user",
      authCode: userError?.code ?? "auth_session_missing"
    });
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,garden_id,active,full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.active === false) {
    console.warn("Digital Observer API session rejected", {
      reason: profile?.active === false ? "inactive_profile" : "profile_not_available",
      databaseCode: profileError?.code ?? null
    });
    return null;
  }

  const [account, ownedSite, membership] = await Promise.all([
    supabase.from("digital_observer_accounts" as any).select("profile_id,account_type,status,onboarding_step,trial_start,trial_end").eq("profile_id", user.id).maybeSingle(),
    supabase.from("observer_sites" as any).select("id").eq("owner_profile_id", user.id).is("garden_id", null).neq("site_type", "kindergarten").limit(1).maybeSingle(),
    supabase.from("observer_site_memberships" as any).select("observer_site_id").eq("profile_id", user.id).eq("active", true).limit(1).maybeSingle()
  ]);
  const isObserver = user.user_metadata?.product === "digital_observer"
    || Boolean(account.data || ownedSite.data || membership.data)
    || profile.role === "admin";
  if (!isObserver) {
    console.warn("Digital Observer API session rejected", {
      reason: "observer_scope_not_available",
      accountCode: account.error?.code ?? null,
      siteCode: ownedSite.error?.code ?? null,
      membershipCode: membership.error?.code ?? null
    });
    return null;
  }

  return { user, profile, observerAccount: account.data ?? null };
}
