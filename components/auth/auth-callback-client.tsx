"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { singleUseAuthCodeExchange } from "@/lib/domain/single-use-auth-code";
import { needsExplicitObserverOptIn, safeAuthNextPath, verifiedCallbackProduct } from "@/lib/domain/auth-flow";
import { persistedProductReadFailed, resolvePersistedAuthProduct } from "@/lib/domain/auth-product-boundary";

const otpTypes = new Set<EmailOtpType>(["email", "signup", "invite", "magiclink", "recovery", "email_change"]);
const exchangeCodeOnce = singleUseAuthCodeExchange((code: string) => createClient().auth.exchangeCodeForSession(code));

function safeNext(value: string | null, observer: boolean, recovery: boolean) {
  return safeAuthNextPath(value, observer ? "digital_observer" : "gan_batuach", recovery ? "recovery" : undefined);
}

function failurePath(observer: boolean, recovery: boolean) {
  if (recovery) return observer
    ? "/digital-observer/forgot-password?error=invalid_link"
    : "/forgot-password?error=invalid_link";
  return observer
    ? "/digital-observer/login?error=confirmation_failed"
    : "/login?error=confirmation_failed";
}

export function AuthCallbackClient({
  productHint,
  flowHint
}: {
  productHint?: "gan_batuach" | "digital_observer";
  flowHint?: "recovery";
}) {
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    // A confirmation code is single-use. Strict Mode replays effects in development,
    // so both effect setups must share one exchange attempt.
    if (started.current) return () => { active.current = false; };
    started.current = true;

    async function complete() {
      const current = new URL(window.location.href);
      const hash = new URLSearchParams(current.hash.replace(/^#/, ""));
      const requestedProduct = current.searchParams.get("product") === "digital_observer"
        ? "digital_observer"
        : productHint ?? "gan_batuach";
      let product: "gan_batuach" | "digital_observer" = requestedProduct;
      let observer = product === "digital_observer";
      const flow = current.searchParams.get("flow") ?? flowHint;
      const nextValue = current.searchParams.get("next");
      const typeValue = (current.searchParams.get("type") || hash.get("type")) as EmailOtpType | null;
      let recovery = flow === "recovery" || typeValue === "recovery" || nextValue === "/digital-observer/set-password" || nextValue === "/reset-password";
      const supabase = createClient();
      let authEvent = "";
      const authEvents = supabase.auth.onAuthStateChange((event) => { authEvent = event; });
      let authenticationError: { code?: string; message?: string } | null = null;
      let user = null as Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];

      const code = current.searchParams.get("code");
      const tokenHash = current.searchParams.get("token_hash");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (current.searchParams.get("error") || current.searchParams.get("error_code") || hash.get("error") || hash.get("error_code")) {
        authEvents.data.subscription.unsubscribe();
        if (active.current) {
          setFailed(true);
          window.setTimeout(() => {
            if (active.current) window.location.replace(failurePath(observer, recovery));
          }, 900);
        }
        return;
      }

      if (code) {
        const result = await exchangeCodeOnce(code);
        authenticationError = result.error;
        user = result.data.user;
      } else if (tokenHash && typeValue && otpTypes.has(typeValue)) {
        let result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typeValue });
        if ((result.error || !result.data.user) && typeValue === "email") {
          result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });
        }
        authenticationError = result.error;
        user = result.data.user;
      } else if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        authenticationError = result.error;
        user = result.data.user;
      } else {
        const result = await supabase.auth.getUser();
        authenticationError = result.error;
        user = result.data.user;
      }

      ["code", "token", "token_hash", "access_token", "refresh_token"].forEach((key) => current.searchParams.delete(key));
      window.history.replaceState({}, "", `${current.pathname}${current.searchParams.size ? `?${current.searchParams.toString()}` : ""}`);

      if (authenticationError || !user) {
        authEvents.data.subscription.unsubscribe();
        if (active.current) {
          setFailed(true);
          window.setTimeout(() => {
            if (active.current) window.location.replace(failurePath(observer, recovery));
          }, 900);
        }
        return;
      }

      recovery = recovery || authEvent === "PASSWORD_RECOVERY";

      const [observerAccountResult, profileResult, parentResult] = await Promise.all([
        supabase.from("digital_observer_accounts" as never).select("profile_id").eq("profile_id", user.id).maybeSingle(),
        supabase.from("profiles").select("id,role").eq("id", user.id).maybeSingle(),
        supabase.from("parents" as never).select("id").or(`profile_id.eq.${user.id},user_id.eq.${user.id}`).limit(1).maybeSingle()
      ]);
      if (persistedProductReadFailed([observerAccountResult, profileResult, parentResult])) {
        authEvents.data.subscription.unsubscribe();
        await supabase.auth.signOut({ scope: "local" });
        window.location.replace("/auth/product-resolution-failed");
        return;
      }
      const persistedProduct = resolvePersistedAuthProduct({
        hasObserverAccount: Boolean(observerAccountResult.data),
        hasGanProfile: Boolean(profileResult.data),
        hasGanParent: Boolean(parentResult.data),
        ganRole: profileResult.data?.role
      });
      observer = persistedProduct === "digital_observer"
        || (persistedProduct === "both" && requestedProduct === "digital_observer")
        || (persistedProduct === "none" && verifiedCallbackProduct(user) === "digital_observer");
      product = observer ? "digital_observer" : "gan_batuach";
      if (!recovery
        && persistedProduct !== "digital_observer"
        && persistedProduct !== "both"
        && needsExplicitObserverOptIn(user, requestedProduct === "digital_observer")) {
        authEvents.data.subscription.unsubscribe();
        await supabase.auth.signOut();
        document.cookie = "auth_callback_product=; Path=/; Max-Age=0; SameSite=Lax";
        document.cookie = "auth_callback_flow=; Path=/; Max-Age=0; SameSite=Lax";
        window.location.replace("/digital-observer/login?error=existing_account_sign_in");
        return;
      }
      const next = safeNext(nextValue, observer, recovery);
      document.cookie = "auth_callback_product=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie = "auth_callback_flow=; Path=/; Max-Age=0; SameSite=Lax";
      authEvents.data.subscription.unsubscribe();

      if (recovery) {
        window.sessionStorage.setItem("auth_recovery_ready", product);
        window.location.replace(next);
        return;
      }

      if (observer) {
        const account = await supabase.rpc("ensure_digital_observer_account" as any, {
          requested_name: user.user_metadata?.full_name ?? null,
          requested_account_type: user.user_metadata?.account_type === "business" ? "business" : "home"
        });
        if (account.error || account.data !== true) {
          await supabase.auth.signOut();
          window.location.replace("/digital-observer/login?error=observer_setup_required");
          return;
        }
        await supabase.auth.signOut();
      }

      const managementContactPending = product === "gan_batuach"
        && user.app_metadata?.contact_verification_required === true
        && !user.email_confirmed_at;
      if (active.current) window.location.replace(managementContactPending ? "/app/verify-contact" : next);
    }

    void complete();
    return () => { active.current = false; };
  }, []);

  return (
    <main className="do-route-state" dir="rtl" aria-live="polite" aria-busy={!failed}>
      <span className="do-route-state-mark">{failed ? <ShieldAlert /> : <CheckCircle2 />}{!failed ? <LoaderCircle className="do-spin" /> : null}</span>
      <h1>{failed ? "לא ניתן להשלים את האימות" : "משלימים את האימות המאובטח"}</h1>
      <p>{failed ? "הקישור אינו תקף, כבר נוצל או שפג תוקפו. נעביר אתכם למסך בקשה חדשה." : "מאמתים את הקישור ומכינים את ההמשך הנכון בלי לחשוף פרטי גישה."}</p>
    </main>
  );
}
