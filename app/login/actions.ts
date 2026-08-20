"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dashboardPathForProfile } from "@/lib/auth";
import { safeObserverReturnPath } from "@/lib/domain/digital-observer/access";
import { isRole } from "@/lib/roles";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const gardenId = String(formData.get("context_garden_id") || "");
  const authSource = String(formData.get("auth_source") || "");
  const requestedNext = String(formData.get("next") || "");
  const observerLogin = authSource === "observer";
  const requestedObserverAccountType = String(formData.get("observer_account_type") || "home") === "business" ? "business" : "home";
  const loginPath = observerLogin ? "/digital-observer/login" : authSource === "app" ? "/app/login" : "/login";
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`${loginPath}?error=${encodeURIComponent(error.message)}`);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // dashboardPathForProfile needs the identity and active state to resolve
  // parent onboarding and assigned/unassigned inspector routes correctly.
  const { data: profile } = await supabase.from("profiles").select("id, role, garden_id, active").eq("id", user?.id ?? "").single();
  const cookieStore = await cookies();
  if (observerLogin && (!user || !profile)) {
    await supabase.auth.signOut();
    redirect("/digital-observer/login?error=observer_setup_required");
  }
  if (observerLogin && user && profile) {
    const metadataProduct = String(user.user_metadata?.product ?? "");
    const [accountResult, ownedSiteResult, membershipResult] = await Promise.all([
      supabase.from("digital_observer_accounts" as any).select("profile_id,account_type,onboarding_step,status").eq("profile_id", user.id).maybeSingle(),
      supabase.from("observer_sites" as any).select("id").eq("owner_profile_id", user.id).is("garden_id", null).neq("site_type", "kindergarten").limit(1).maybeSingle(),
      supabase.from("observer_site_memberships" as any).select("observer_site_id").eq("profile_id", user.id).eq("active", true).limit(1).maybeSingle()
    ]);
    let observerAccount = accountResult.data;
    if (!observerAccount) {
      const account = await supabase.rpc("ensure_digital_observer_account" as any, {
        requested_name: user.user_metadata?.full_name ?? null,
        requested_account_type: metadataProduct === "digital_observer"
          ? user.user_metadata?.account_type ?? requestedObserverAccountType
          : requestedObserverAccountType
      });
      if (account.error || account.data !== true) {
        await supabase.auth.signOut();
        redirect("/digital-observer/login?error=observer_setup_required");
      }
      const refreshedAccount = await supabase
        .from("digital_observer_accounts" as any)
        .select("profile_id,account_type,onboarding_step,status")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (refreshedAccount.error || !refreshedAccount.data) {
        await supabase.auth.signOut();
        redirect("/digital-observer/login?error=observer_setup_required");
      }
      observerAccount = refreshedAccount.data;
    }

    cookieStore.set("gb_active_product", "digital_observer", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    const requestedObserverPath = safeObserverReturnPath(requestedNext);
    const hasSite = Boolean(ownedSiteResult.data || membershipResult.data);
    const destination = !hasSite && requestedObserverPath === "/digital-observer/dashboard"
      ? `/digital-observer/onboarding?type=${observerAccount?.account_type === "business" ? "business" : "home"}`
      : requestedObserverPath;
    redirect(destination);
  }
  cookieStore.set("gb_active_product", "gan_batuach", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  const role = profile?.role;
  const path = isRole(role) && profile ? await dashboardPathForProfile(profile) : "/dashboard";
  redirect(gardenId ? `${path}?gardenId=${encodeURIComponent(gardenId)}` : path);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/app/login");
}
