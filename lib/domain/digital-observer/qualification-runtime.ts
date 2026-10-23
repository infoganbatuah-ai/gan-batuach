type QualificationRuntimeEnvironment = Partial<Record<
  | "NODE_ENV"
  | "APP_ENV"
  | "NEXT_PUBLIC_APP_ENV"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_ADMIN_URL"
  | "OBSERVER_PUSH38_QUALIFICATION"
  | "OBSERVER_PUSH38_QUALIFICATION_EXACT_BUILD",
  string | undefined
>>;

function isExactLoopbackUrl(value: string | undefined, expectedPort: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" &&
      url.port === expectedPort && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/**
 * Allows PUSH 38 qualification APIs only inside the pinned, isolated local QA
 * stack. A production-mode Next build needs the explicit exact-build flag;
 * that flag is insufficient unless both Supabase surfaces are exact loopback
 * endpoints and both application environment labels remain local.
 */
export function isIsolatedPush38QualificationRuntime(
  env: QualificationRuntimeEnvironment = process.env
) {
  if (env.OBSERVER_PUSH38_QUALIFICATION !== "enabled" ||
    env.APP_ENV !== "local" || env.NEXT_PUBLIC_APP_ENV !== "local" ||
    !isExactLoopbackUrl(env.NEXT_PUBLIC_SUPABASE_URL, "56421") ||
    !isExactLoopbackUrl(env.SUPABASE_ADMIN_URL, "56431")) return false;

  if (env.NODE_ENV === "development") return true;
  return env.NODE_ENV === "production" &&
    env.OBSERVER_PUSH38_QUALIFICATION_EXACT_BUILD === "enabled";
}
