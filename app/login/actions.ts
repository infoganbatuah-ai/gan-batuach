"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dashboardPathForProfile } from "@/lib/auth";
import { isRole } from "@/lib/roles";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const gardenId = String(formData.get("context_garden_id") || "");
  const authSource = String(formData.get("auth_source") || "");
  const loginPath = authSource === "app" ? "/app/login" : "/login";
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`${loginPath}?error=${encodeURIComponent(error.message)}`);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("role, garden_id").eq("id", user?.id ?? "").single();
  const role = profile?.role;
  const path = isRole(role) && profile ? await dashboardPathForProfile(profile) : "/dashboard";
  redirect(gardenId ? `${path}?gardenId=${encodeURIComponent(gardenId)}` : path);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/app/login");
}
