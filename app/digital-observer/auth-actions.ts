"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function registerDigitalObserver(formData: FormData) {
  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const accountType = String(formData.get("account_type") || "home");
  if (fullName.length < 2 || !email.includes("@") || password.length < 8 || !["home", "business"].includes(accountType)) {
    redirect("/digital-observer/register?error=invalid");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, product: "digital_observer", account_type: accountType } }
  });
  if (error) redirect(`/digital-observer/register?error=${encodeURIComponent(error.message)}`);
  if (data.session) {
    const claim = await supabase.rpc("claim_digital_observer_profile" as any, { requested_name: fullName });
    if (claim.error || claim.data !== true) redirect("/digital-observer/register?error=profile_claim_failed");
    redirect(`/digital-observer/onboarding?type=${accountType}`);
  }
  redirect("/digital-observer/login?registered=check_email");
}
