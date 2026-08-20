"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_URL || "http://localhost:3000";
  return configured.startsWith("http://") || configured.startsWith("https://") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
}

function emailRedirectTo() {
  return `${appOrigin()}/auth/callback?product=digital_observer&next=${encodeURIComponent("/digital-observer/login?verified=1")}`;
}

async function rememberPendingEmail(email: string) {
  const cookieStore = await cookies();
  cookieStore.set("do_pending_email", email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
    path: "/"
  });
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        product: "digital_observer",
        account_type: accountType,
        onboarding_source: "digital_observer_standalone"
      },
      emailRedirectTo: emailRedirectTo()
    }
  });
  if (error) redirect(`/digital-observer/register?error=${encodeURIComponent(error.message)}`);
  await rememberPendingEmail(email);

  if (data.session && data.user) {
    const account = await supabase.rpc("ensure_digital_observer_account" as any, {
      requested_name: fullName,
      requested_account_type: accountType
    });
    if (account.error || account.data !== true) redirect("/digital-observer/verify?error=account_setup_failed");
    await supabase.auth.signOut();
    const cookieStore = await cookies();
    cookieStore.delete("do_pending_email");
    redirect("/digital-observer/login?verified=1");
  }

  redirect("/digital-observer/verify");
}

export async function verifyDigitalObserverEmailCode(formData: FormData) {
  const cookieStore = await cookies();
  const email = String(formData.get("email") || cookieStore.get("do_pending_email")?.value || "").trim().toLowerCase();
  const token = String(formData.get("code") || "").replace(/\s/g, "");
  if (!email) redirect("/digital-observer/verify?error=missing_email");
  if (!/^\d{6,8}$/.test(token)) redirect("/digital-observer/verify?error=invalid_code");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) redirect("/digital-observer/verify?error=invalid_code");

  const product = data.user.user_metadata?.product;
  if (product !== "digital_observer") {
    await supabase.auth.signOut();
    redirect("/digital-observer/verify?error=account_setup_failed");
  }
  const account = await supabase.rpc("ensure_digital_observer_account" as any, {
    requested_name: data.user.user_metadata?.full_name ?? null,
    requested_account_type: data.user.user_metadata?.account_type ?? "home"
  });
  if (account.error || account.data !== true) {
    await supabase.auth.signOut();
    redirect("/digital-observer/verify?error=account_setup_failed");
  }

  await supabase.auth.signOut();
  cookieStore.delete("do_pending_email");
  redirect("/digital-observer/login?verified=1");
}

export async function resendDigitalObserverVerification(formData: FormData) {
  const cookieStore = await cookies();
  const email = String(formData.get("email") || cookieStore.get("do_pending_email")?.value || "").trim().toLowerCase();
  if (!email) redirect("/digital-observer/verify?error=missing_email");

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: emailRedirectTo() }
  });
  if (error) redirect("/digital-observer/verify?error=resend_failed");
  await rememberPendingEmail(email);
  redirect("/digital-observer/verify?resent=1");
}
