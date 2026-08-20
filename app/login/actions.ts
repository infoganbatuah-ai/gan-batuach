"use server";

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
  const loginPath = observerLogin ? "/digital-observer/login" : authSource === "app" ? "/app/login" : "/login";
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`${loginPath}?error=${encodeURIComponent(error.message)}`);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // dashboardPathForProfile needs the identity and active state to resolve
  // parent onboarding and assigned/unassigned inspector routes correctly.
  let { data: profile } = await supabase.from("profiles").select("id, role, garden_id, active").eq("id", user?.id ?? "").single();
  if (observerLogin && profile?.role === "parent" && !profile.garden_id) {
    const claim = await supabase.rpc("claim_digital_observer_profile" as any, { requested_name: null });
    if (!claim.error && claim.data === true) {
      const refreshed = await supabase.from("profiles").select("id, role, garden_id, active").eq("id", user?.id ?? "").single();
      profile = refreshed.data;
    }
  }
  if (observerLogin && profile && ["network_manager", "admin"].includes(String(profile.role))) {
    redirect(safeObserverReturnPath(requestedNext));
  }
  const role = profile?.role;
  const path = isRole(role) && profile ? await dashboardPathForProfile(profile) : "/dashboard";
  redirect(gardenId ? `${path}?gardenId=${encodeURIComponent(gardenId)}` : path);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/app/login");
}
