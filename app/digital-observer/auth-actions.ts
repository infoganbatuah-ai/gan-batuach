"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function shouldSkipDigitalObserverEmailConfirmation() {
  return (
    process.env.DIGITAL_OBSERVER_SKIP_EMAIL_CONFIRMATION === "true" &&
    process.env.NODE_ENV !== "production"
  ) || process.env.NEXT_PUBLIC_SANDBOX_MODE === "true" || process.env.APP_ENV === "demo" || process.env.APP_ENV === "local";
}

export async function registerDigitalObserver(formData: FormData) {
  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const accountType = String(formData.get("account_type") || "home");
  if (fullName.length < 2 || !email.includes("@") || password.length < 8 || !["home", "business"].includes(accountType)) {
    redirect("/digital-observer/register?error=invalid");
  }
  const supabase = await createClient();
  const skipEmailConfirmation = shouldSkipDigitalObserverEmailConfirmation();
  const signUpOptions: { data: { full_name: string; product: string; account_type: string }; email_confirm?: boolean } = {
    data: { full_name: fullName, product: "digital_observer", account_type: accountType }
  };
  if (skipEmailConfirmation) {
    signUpOptions.email_confirm = true;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: signUpOptions
  });
  if (error) redirect(`/digital-observer/register?error=${encodeURIComponent(error.message)}`);

  if (skipEmailConfirmation && data.user && !data.session) {
    const loginResult = await supabase.auth.signInWithPassword({ email, password });
    if (loginResult.error) {
      const fallbackMessage = encodeURIComponent("נרשמת בהצלחה אך לא הצלחנו להכנס אוטומטית. התחברו שוב ידנית.");
      redirect(`/digital-observer/login?error=${fallbackMessage}`);
    }
  }

  if (data.session || (skipEmailConfirmation && data.user)) {
    const claim = await supabase.rpc("claim_digital_observer_profile" as any, { requested_name: fullName });
    if (claim.error || claim.data !== true) redirect("/digital-observer/register?error=profile_claim_failed");
    redirect(`/digital-observer/onboarding?type=${accountType}`);
  }

  redirect("/digital-observer/login?registered=check_email");
}
