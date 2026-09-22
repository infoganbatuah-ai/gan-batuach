export type AuthProduct = "gan_batuach" | "digital_observer";

export const CANONICAL_APP_ORIGIN = "https://ganbatuach.com";

function normalizeOrigin(value: string) {
  const normalized = value.replace(/\/$/, "");
  const url = new URL(
    normalized.startsWith("http://") || normalized.startsWith("https://")
      ? normalized
      : `https://${normalized}`
  );
  if (url.hostname.endsWith(".vercel.app") || url.hostname === "www.ganbatuach.com") {
    return CANONICAL_APP_ORIGIN;
  }
  return url.origin;
}

export function appOrigin() {
  if (process.env.NODE_ENV === "production") return CANONICAL_APP_ORIGIN;
  return normalizeOrigin(
    process.env.NEXT_PUBLIC_APP_URL
      || process.env.APP_URL
      || "http://localhost:3000"
  );
}

export function authCallbackUrl(product: AuthProduct, next: string, flow: "verify" | "recovery") {
  // Keep the redirect identical to the Supabase allow-list entry. Product and
  // flow are derived from the verified user and OTP type after the callback.
  void product;
  void next;
  void flow;
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
