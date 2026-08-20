"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
    || "http://localhost:3000";
  return configured.startsWith("http://") || configured.startsWith("https://") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
}

function emailRedirectTo() {
  return `${appOrigin()}/auth/callback?product=digital_observer&next=${encodeURIComponent("/digital-observer/login?verified=1")}`;
}

type AuthEmailError = { code?: string; message?: string; status?: number } | null;

function authEmailErrorCode(error: AuthEmailError) {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();
  if (code.includes("rate_limit") || message.includes("rate limit")) return "email_rate_limited";
  if (code.includes("email_address_not_authorized") || message.includes("not authorized")) return "email_not_authorized";
  if (code.includes("invalid_api_key") || message.includes("unregistered api key")) return "supabase_configuration_error";
  return "email_delivery_failed";
}

function reportAuthEmailFailure(action: "signup" | "resend", error: AuthEmailError) {
  console.error("Digital Observer authentication email failed", {
    action,
    category: authEmailErrorCode(error),
    code: error?.code ?? "unknown",
    status: error?.status ?? null
  });
}

function reportObserverAccountSetupFailure(
  action: "signup" | "code_verification",
  error: { code?: string; message?: string } | null,
  result: unknown
) {
  console.error("Digital Observer account preparation failed after successful authentication", {
    action,
    code: error?.code ?? "unknown",
    message: error?.message ?? "No database error returned",
    returnedTrue: result === true
  });
}

async function rememberPendingRegistration(email: string, fullName?: string, accountType?: string) {
  const cookieStore = await cookies();
  cookieStore.set("do_pending_email", email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
    path: "/"
  });
  if (fullName) {
    cookieStore.set("do_pending_name", fullName, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60,
      path: "/"
    });
  }
  if (accountType) {
    cookieStore.set("do_pending_account_type", accountType === "business" ? "business" : "home", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60,
      path: "/"
    });
  }
}

async function clearPendingRegistration() {
  const cookieStore = await cookies();
  cookieStore.delete("do_pending_email");
  cookieStore.delete("do_pending_name");
  cookieStore.delete("do_pending_account_type");
}

async function sendObserverAccessEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string
) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: emailRedirectTo()
    }
  });
}

function isExistingIdentityResult(data: { user?: { identities?: unknown[] | null } | null }) {
  return !data.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0);
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
  if (error) {
    const existingAccount = error.code === "user_already_exists"
      || error.message.toLowerCase().includes("already registered");
    if (existingAccount) {
      await rememberPendingRegistration(email, fullName, accountType);
      const accessEmail = await sendObserverAccessEmail(supabase, email);
      if (accessEmail.error) {
        reportAuthEmailFailure("resend", accessEmail.error);
        redirect(`/digital-observer/register?error=${authEmailErrorCode(accessEmail.error)}`);
      }
      redirect("/digital-observer/verify?resent=1&existing=1");
    }
    reportAuthEmailFailure("signup", error);
    redirect(`/digital-observer/register?error=${authEmailErrorCode(error)}`);
  }
  await rememberPendingRegistration(email, fullName, accountType);

  if (isExistingIdentityResult(data)) {
    const accessEmail = await sendObserverAccessEmail(supabase, email);
    if (accessEmail.error) {
      reportAuthEmailFailure("resend", accessEmail.error);
      redirect(`/digital-observer/register?error=${authEmailErrorCode(accessEmail.error)}`);
    }
    redirect("/digital-observer/verify?resent=1&existing=1");
  }

  if (data.session && data.user) {
    const account = await supabase.rpc("ensure_digital_observer_account" as any, {
      requested_name: fullName,
      requested_account_type: accountType
    });
    if (account.error || account.data !== true) {
      reportObserverAccountSetupFailure("signup", account.error, account.data);
      await supabase.auth.signOut();
      redirect("/digital-observer/login?error=observer_setup_required");
    }
    await supabase.auth.signOut();
    await clearPendingRegistration();
    redirect("/digital-observer/login?verified=1");
  }

  redirect("/digital-observer/verify");
}

export async function verifyDigitalObserverEmailCode(formData: FormData) {
  const cookieStore = await cookies();
  const email = String(formData.get("email") || cookieStore.get("do_pending_email")?.value || "").trim().toLowerCase();
  const pendingName = cookieStore.get("do_pending_name")?.value ?? null;
  const pendingAccountTypeValue = cookieStore.get("do_pending_account_type")?.value;
  const pendingAccountType = pendingAccountTypeValue === "business" || pendingAccountTypeValue === "home"
    ? pendingAccountTypeValue
    : null;
  const token = String(formData.get("code") || "").replace(/\s/g, "");
  if (!email) redirect("/digital-observer/verify?error=missing_email");
  if (!/^\d{6,8}$/.test(token)) redirect("/digital-observer/verify?error=invalid_code");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) redirect("/digital-observer/verify?error=invalid_code");

  const account = await supabase.rpc("ensure_digital_observer_account" as any, {
    requested_name: pendingName ?? data.user.user_metadata?.full_name ?? null,
    requested_account_type: pendingAccountType ?? data.user.user_metadata?.account_type ?? "home"
  });
  if (account.error || account.data !== true) {
    reportObserverAccountSetupFailure("code_verification", account.error, account.data);
  }

  await supabase.auth.signOut();
  await clearPendingRegistration();
  redirect("/digital-observer/login?verified=1");
}

export async function resendDigitalObserverVerification(formData: FormData) {
  const cookieStore = await cookies();
  const email = String(formData.get("email") || cookieStore.get("do_pending_email")?.value || "").trim().toLowerCase();
  if (!email) redirect("/digital-observer/verify?error=missing_email");

  const supabase = await createClient();
  const { error } = await sendObserverAccessEmail(supabase, email);
  if (error) {
    reportAuthEmailFailure("resend", error);
    redirect(`/digital-observer/verify?error=${authEmailErrorCode(error)}`);
  }
  await rememberPendingRegistration(email);
  redirect("/digital-observer/verify?resent=1&existing=1");
}
