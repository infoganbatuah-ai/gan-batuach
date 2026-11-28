// Offline configuration gate only. This does not verify a deployed host,
// Cloudflare policy, Supabase redirect allowlist, or the project's isolation.
export const OBSERVER_QA_HOSTED_ORIGIN = "https://observer-qa.ganbatuach.com";
export const OBSERVER_QA_HOSTED_CALLBACK = `${OBSERVER_QA_HOSTED_ORIGIN}/auth/callback`;

const refPattern = /^[a-z0-9]{20}$/;

export function validateObserverQaHostedConfig(input) {
  if (!input || input.NEXT_PUBLIC_APP_URL !== OBSERVER_QA_HOSTED_ORIGIN ||
      input.APP_URL !== OBSERVER_QA_HOSTED_ORIGIN ||
      input.AUTH_REDIRECT_URL !== OBSERVER_QA_HOSTED_CALLBACK ||
      input.OBSERVER_QA_ACCESS_HOST !== "observer-qa.ganbatuach.com") {
    throw new Error("OBSERVER_QA_HOSTED_ORIGIN_OR_ACCESS_TARGET_INVALID");
  }
  const qaRef = input.OBSERVER_QA_SUPABASE_REF;
  const productionRef = input.PRODUCTION_SUPABASE_REF;
  if (typeof qaRef !== "string" || !refPattern.test(qaRef) ||
      typeof productionRef !== "string" || !refPattern.test(productionRef) ||
      qaRef === productionRef ||
      input.NEXT_PUBLIC_SUPABASE_URL !== `https://${qaRef}.supabase.co`) {
    throw new Error("OBSERVER_QA_HOSTED_SUPABASE_ISOLATION_INVALID");
  }
  return Object.freeze({
    status: "offline_configuration_only",
    host: "observer-qa.ganbatuach.com",
    callback: OBSERVER_QA_HOSTED_CALLBACK,
    qaSupabaseRef: qaRef
  });
}
