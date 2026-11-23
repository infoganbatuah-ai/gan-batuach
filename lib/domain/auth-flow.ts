export type AuthProduct = "gan_batuach" | "digital_observer";

/** URL hints may choose an error page, never the authenticated product path. */
export function verifiedCallbackProduct(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}): AuthProduct {
  if (user.user_metadata?.product === "digital_observer" || user.app_metadata?.digital_observer_admin === true) {
    return "digital_observer";
  }
  return "gan_batuach";
}

/** A browser hint can request the explicit sign-in screen, never provisioning. */
export function needsExplicitObserverOptIn(user: Parameters<typeof verifiedCallbackProduct>[0], observerIntent: boolean) {
  return observerIntent && verifiedCallbackProduct(user) !== "digital_observer";
}

export function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
    || "http://localhost:3000";
  const normalized = configured.replace(/\/$/, "");
  return normalized.startsWith("http://") || normalized.startsWith("https://")
    ? normalized
    : `https://${normalized}`;
}

export function authCallbackUrl(product: AuthProduct, next: string, flow: "verify" | "recovery") {
  // This must remain byte-for-byte identical to the approved Supabase redirect.
  // Product intent is resolved after authentication from persisted account data.
  void product;
  void next;
  void flow;
  return `${appOrigin()}/auth/callback`;
}

export function safeAuthNextPath(value: string | null | undefined, product: AuthProduct, flow?: string | null) {
  const fallback = flow === "recovery"
    ? product === "digital_observer" ? "/digital-observer/set-password" : "/reset-password"
    : product === "digital_observer" ? "/digital-observer/login?verified=1" : "/dashboard";
  if (!value || value.length > 2_048 || !value.startsWith("/") || value.startsWith("//")) return fallback;
  // Reject ambiguous separators and dot segments before URL normalization: a
  // textual prefix check alone accepts /digital-observer/../dashboard.
  if (/[\\\u0000-\u001f\u007f#]/.test(value) || /%(?:2e|2f|5c|25(?:2e|2f|5c))/i.test(value)) return fallback;
  const rawPath = value.split("?", 1)[0];
  if (rawPath.includes("//") || rawPath.includes("%")) return fallback;
  try {
    const parsed = new URL(value, "https://auth-return.invalid");
    if (parsed.origin !== "https://auth-return.invalid" || parsed.pathname !== rawPath) return fallback;
    if (product === "digital_observer") {
      if (parsed.pathname !== "/digital-observer" && !parsed.pathname.startsWith("/digital-observer/")) return fallback;
    } else if (parsed.pathname === "/digital-observer" || parsed.pathname.startsWith("/digital-observer/")) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
