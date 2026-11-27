import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeObserverReturnPath } from "@/lib/domain/digital-observer/access";
import { authenticateAndPrepareObserverLogin, resolveObserverLoginContext } from "@/lib/domain/digital-observer/observer-login-auth";
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

  // Never forward a newly minted Auth cookie when session cleanup failed.
  const cleanupFailure = () => NextResponse.json({ error: "session_cleanup_failed" }, {
    status: 503,
    headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0" }
  });

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

  const authentication = await authenticateAndPrepareObserverLogin(email, password, {
    signIn: async (loginEmail, loginPassword) => {
      const result = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      return { user: result.data.user, error: result.error };
    },
    currentUser: async () => {
      const result = await supabase.auth.getUser();
      return { user: result.data.user, error: result.error };
    },
    ensureOwnAccount: async (currentUser) => {
      const result = await supabase.rpc("ensure_digital_observer_account" as any, {
        requested_name: currentUser.user_metadata?.full_name ?? null,
        requested_account_type: currentUser.user_metadata?.account_type ?? requestedAccountType
      });
      return { ok: !result.error && result.data === true, code: result.error?.code ?? "account_not_prepared" };
    },
    signOut: () => supabase.auth.signOut()
  });
  if (authentication.status === "session_cleanup_failed") return cleanupFailure();
  if (authentication.status === "invalid_login") {
    return buildRedirect(loginErrorPath(authErrorCode(authentication.error), requestedNext));
  }
  if (authentication.status !== "ok") {
    console.error("Digital Observer login account preparation failed", {
      code: authentication.code ?? authentication.status
    });
    return buildRedirect(loginErrorPath("observer_setup_required", requestedNext));
  }
  const user = authentication.user;

  const [profileResult, accountResult, ownedSiteResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("id,active").eq("id", user.id).maybeSingle(),
    supabase.from("digital_observer_accounts" as any).select("profile_id,account_type,status").eq("profile_id", user.id).maybeSingle(),
    supabase.from("observer_sites" as any).select("id").eq("owner_profile_id", user.id).is("garden_id", null).neq("site_type", "kindergarten").limit(1).maybeSingle(),
    supabase.from("observer_site_memberships" as any).select("observer_site_id").eq("profile_id", user.id).eq("active", true).limit(1).maybeSingle()
  ]);

  const rawAccount: unknown = accountResult.data;
  const context = resolveObserverLoginContext({
    userId: user.id,
    observerAdmin: user.app_metadata?.digital_observer_admin === true,
    requestedNext,
    profile: profileResult,
    account: {
      data: rawAccount && typeof rawAccount === "object"
        && "profile_id" in rawAccount && typeof rawAccount.profile_id === "string"
        ? {
            profile_id: rawAccount.profile_id,
            account_type: "account_type" in rawAccount && typeof rawAccount.account_type === "string"
              ? rawAccount.account_type : null
          }
        : null,
      error: accountResult.error
    },
    ownedSite: ownedSiteResult,
    membership: membershipResult
  });
  if (!context.ok) {
    try {
      const cleanup = await supabase.auth.signOut();
      if (cleanup.error) return cleanupFailure();
    } catch {
      return cleanupFailure();
    }
    return buildRedirect(loginErrorPath("observer_setup_required", requestedNext));
  }

  return buildRedirect(context.destination, true);
}
