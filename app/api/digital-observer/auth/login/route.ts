import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeObserverReturnPath } from "@/lib/domain/digital-observer/access";
import type { Database } from "@/lib/supabase/types";

type PendingCookie = { name: string; value: string; options: CookieOptions };

function loginErrorPath(code: string, next: string) {
  const params = new URLSearchParams({ error: code });
  if (next) params.set("next", next);
  return `/digital-observer/login?${params.toString()}`;
}

function authErrorCode(error: { code?: string; message?: string } | null) {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();
  if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) return "email_not_confirmed";
  return "invalid_login";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext = safeObserverReturnPath(String(formData.get("next") ?? ""));
  const requestedAccountType = String(formData.get("observer_account_type") ?? "home") === "business" ? "business" : "home";
  const pendingCookies = new Map<string, PendingCookie>();
  const responseHeaders = new Map<string, string>();

  const buildRedirect = (path: string, activeProduct = false) => {
    const response = NextResponse.redirect(new URL(path, request.url), 303);
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    responseHeaders.forEach((value, key) => response.headers.set(key, value));
    if (activeProduct) {
      response.cookies.set("gb_active_product", "digital_observer", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
      });
    }
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
    return response;
  };

  if (!email.includes("@") || password.length < 1) {
    return buildRedirect(loginErrorPath("invalid_login", requestedNext));
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      },
      cookies: {
        getAll() {
          const combined = new Map(request.cookies.getAll().map(({ name, value }) => [name, { name, value }]));
          pendingCookies.forEach(({ name, value }) => combined.set(name, { name, value }));
          return [...combined.values()];
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach((cookie) => pendingCookies.set(cookie.name, cookie));
          Object.entries(headers).forEach(([key, value]) => responseHeaders.set(key, value));
        }
      }
    }
  );

  const loginResult = await supabase.auth.signInWithPassword({ email, password });
  if (loginResult.error || !loginResult.data.user) {
    return buildRedirect(loginErrorPath(authErrorCode(loginResult.error), requestedNext));
  }

  const user = loginResult.data.user;
  const preparedAccount = await supabase.rpc("ensure_digital_observer_account" as any, {
    requested_name: user.user_metadata?.full_name ?? null,
    requested_account_type: user.user_metadata?.account_type ?? requestedAccountType
  });
  if (preparedAccount.error || preparedAccount.data !== true) {
    console.error("Digital Observer login account preparation failed", {
      code: preparedAccount.error?.code ?? "account_not_prepared"
    });
    await supabase.auth.signOut();
    return buildRedirect(loginErrorPath("observer_setup_required", requestedNext));
  }

  const [profileResult, accountResult, ownedSiteResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("id,active").eq("id", user.id).maybeSingle(),
    supabase.from("digital_observer_accounts" as any).select("profile_id,account_type,status").eq("profile_id", user.id).maybeSingle(),
    supabase.from("observer_sites" as any).select("id").eq("owner_profile_id", user.id).is("garden_id", null).neq("site_type", "kindergarten").limit(1).maybeSingle(),
    supabase.from("observer_site_memberships" as any).select("observer_site_id").eq("profile_id", user.id).eq("active", true).limit(1).maybeSingle()
  ]);

  const observerAccount = accountResult.data as { account_type?: string | null } | null;
  if (!profileResult.data || profileResult.data.active === false || !observerAccount) {
    await supabase.auth.signOut();
    return buildRedirect(loginErrorPath("observer_setup_required", requestedNext));
  }

  const hasSite = Boolean(ownedSiteResult.data || membershipResult.data);
  const accountType = observerAccount.account_type === "business" ? "business" : "home";
  const observerAdmin = user.app_metadata?.digital_observer_admin === true;
  const destination = observerAdmin && requestedNext === "/digital-observer/dashboard"
    ? "/digital-observer/admin"
    : !hasSite && requestedNext === "/digital-observer/dashboard"
    ? `/digital-observer/onboarding?type=${accountType}`
    : requestedNext;

  return buildRedirect(destination, true);
}
