export type AuthProduct = "gan_batuach" | "digital_observer";

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

export function authCallbackUrl(_product: AuthProduct, _next: string, _flow: "verify" | "recovery") {
  // Keep the redirect identical to the Supabase allow-list entry. Product and
  // flow are derived from the verified user and OTP type after the callback.
  return `${appOrigin()}/auth/callback`;
}

export function safeAuthNextPath(value: string | null | undefined, product: AuthProduct, flow?: string | null) {
  const fallback = flow === "recovery"
    ? product === "digital_observer" ? "/digital-observer/set-password" : "/reset-password"
    : product === "digital_observer" ? "/digital-observer/login?verified=1" : "/dashboard";
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (product === "digital_observer" && !value.startsWith("/digital-observer")) return fallback;
  return value;
}
