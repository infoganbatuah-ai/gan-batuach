"use client";

import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { rememberObserverAccessToken } from "@/lib/domain/digital-observer/client-session";
import { createClient } from "@/lib/supabase/browser";

function safeReturnPath(value: string) {
  return value.startsWith("/digital-observer") && !value.startsWith("//")
    ? value
    : "/digital-observer/dashboard";
}

function loginErrorMessage(error: { code?: string; message?: string } | null) {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();
  if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) {
    return "כתובת המייל עדיין לא אומתה. אשרו את הקוד או את הקישור שנשלח למייל ואז נסו שוב.";
  }
  return "פרטי ההתחברות אינם נכונים. בדקו את כתובת המייל והסיסמה ונסו שוב.";
}

export function ObserverLoginForm({
  initialType,
  nextPath,
  registered,
  verified,
  passwordUpdated,
  verificationRequired,
  initialError
}: {
  initialType: "home" | "business";
  nextPath: string;
  registered: boolean;
  verified: boolean;
  passwordUpdated: boolean;
  verificationRequired: boolean;
  initialError?: string;
}) {
  return <ScopedObserverLoginForm key={JSON.stringify([initialType, nextPath])} initialType={initialType} nextPath={nextPath} registered={registered} verified={verified} passwordUpdated={passwordUpdated} verificationRequired={verificationRequired} initialError={initialError} />;
}

function ScopedObserverLoginForm({ initialType, nextPath, registered, verified, passwordUpdated, verificationRequired, initialError }: Parameters<typeof ObserverLoginForm>[0]) {
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [lifecycle, setLifecycle] = useState(0);
  const ownership = useRef({ active: false, operation: 0, busy: false, lifecycle: 0, resetBusy: false });
  useLayoutEffect(() => {
    const owner = ownership.current;
    owner.active = true;
    if (owner.lifecycle > 0) setLifecycle(owner.lifecycle);
    if (owner.resetBusy) { owner.resetBusy = false; setBusy(false); }
    return () => {
      owner.resetBusy = owner.busy;
      owner.active = false; owner.operation++; owner.lifecycle++; owner.busy = false;
    };
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    const owner = ownership.current;
    if (!owner.active || owner.lifecycle !== lifecycle) return;
    // Native WebViews use the server form flow so Supabase credentials remain in
    // HttpOnly cookies. The bearer token is never copied into JavaScript storage.
    if (Capacitor.isNativePlatform()) return;
    event.preventDefault();
    if (owner.busy) return;
    owner.busy = true;
    const operation = ++owner.operation;
    const isCurrent = () => owner.active && owner.operation === operation;
    let navigating = false;
    setBusy(true);
    setError("");
    try {
      const form = event.currentTarget;
      const submittedNextPath = nextPath;
      const formData = new FormData(form);
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "");
      const requestedType = String(formData.get("observer_account_type") ?? "home") === "business" ? "business" : "home";
      if (!isCurrent()) return;
      const supabase = createClient();
      if (!isCurrent()) return;

      const loginResult = await supabase.auth.signInWithPassword({ email, password });
      if (!isCurrent()) return;
      if (loginResult.error || !loginResult.data.user) {
        setError(loginErrorMessage(loginResult.error));
        return;
      }

      const user = loginResult.data.user;
      const preparedAccount = await supabase.rpc("ensure_digital_observer_account" as any, {
        requested_name: user.user_metadata?.full_name ?? null,
        requested_account_type: user.user_metadata?.account_type ?? requestedType
      });
      if (!isCurrent()) return;
      if (preparedAccount.error || preparedAccount.data !== true) {
        if (!isCurrent()) return;
        await supabase.auth.signOut();
        if (!isCurrent()) return;
        setError("ההתחברות הצליחה, אך הכנת חשבון התצפיתן לא הושלמה. נסו שוב או פנו לתמיכה.");
        return;
      }

      const results = await Promise.all([
      supabase.from("digital_observer_accounts" as any).select("account_type").eq("profile_id", user.id).maybeSingle(),
      supabase.from("observer_sites" as any).select("id").eq("owner_profile_id", user.id).is("garden_id", null).neq("site_type", "kindergarten").limit(1).maybeSingle(),
      supabase.from("observer_site_memberships" as any).select("observer_site_id").eq("profile_id", user.id).eq("active", true).limit(1).maybeSingle()
      ]);
      if (!isCurrent()) return;
      const [accountResult, ownedSiteResult, membershipResult] = results;
      const account = accountResult.data as { account_type?: string | null } | null;
      if (!account) {
        if (!isCurrent()) return;
        await supabase.auth.signOut();
        if (!isCurrent()) return;
        setError("חשבון התצפיתן לא נמצא לאחר ההתחברות. נסו שוב או פנו לתמיכה.");
        return;
      }

      const requestedDestination = safeReturnPath(submittedNextPath);
      const observerAdmin = user.app_metadata?.digital_observer_admin === true;
      const hasSite = Boolean(ownedSiteResult.data || membershipResult.data);
      const accountType = account.account_type === "business" ? "business" : "home";
      const destination = observerAdmin && requestedDestination === "/digital-observer/dashboard"
        ? "/digital-observer/admin"
        : !hasSite && requestedDestination === "/digital-observer/dashboard"
        ? `/digital-observer/onboarding?type=${accountType}`
        : requestedDestination;
      if (!isCurrent()) return;
      rememberObserverAccessToken(loginResult.data.session?.access_token);
      if (!isCurrent()) return;
      window.location.assign(destination);
      if (!isCurrent()) return;
      navigating = true;
    } catch {
      if (!isCurrent()) return;
      setError(loginErrorMessage(null));
    } finally {
      if (isCurrent() && !navigating) { owner.busy = false; setBusy(false); }
    }
  }

  return (
    <form action="/api/digital-observer/auth/login" method="post" className="do-auth-card" data-hydrated={hydrated ? "true" : "false"} onSubmit={submit}>
      <ObserverMark compact />
      <h2><span className="do-auth-heading-desktop">התחברות</span><span className="do-auth-heading-mobile">ברוכים הבאים</span></h2>
      <p>היכנסו לחשבון התצפיתן הדיגיטלי שלכם</p>
      {registered ? <div className="do-notice good"><ShieldCheck /><span>ההרשמה נקלטה. יש לאשר את כתובת הדוא״ל ואז להתחבר.</span></div> : null}
      {verified ? <div className="do-notice good" role="status"><ShieldCheck /><span>כתובת המייל אומתה בהצלחה. אפשר להתחבר ולהמשיך את הקמת התצפיתן.</span></div> : null}
      {passwordUpdated ? <div className="do-notice good" role="status"><ShieldCheck /><span>הסיסמה עודכנה. התחברו עם הסיסמה החדשה.</span></div> : null}
      {error ? <div className="do-notice bad" role="alert"><LockKeyhole /><span>{error}</span></div> : null}
      <input type="hidden" name="auth_source" value="observer" />
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="observer_account_type" value={initialType} />
      <label className="do-field"><span>דוא״ל</span><input name="email" type="email" autoComplete="email" required disabled={busy} /></label>
      <label className="do-field"><span>סיסמה</span><input name="password" type="password" autoComplete="current-password" required disabled={busy} /></label>
      <Link className="do-auth-password-help" href="/digital-observer/forgot-password">שכחתי סיסמה</Link>
      <button className="do-button primary full" type="submit" disabled={busy || !hydrated}>{busy ? <LoaderCircle className="do-spin" /> : null}{busy ? "מתחברים..." : "התחברות"}</button>
      <button
        className="do-auth-google"
        type="button"
        disabled
        aria-describedby="do-google-readiness"
        title="התחברות עם Google עדיין אינה פעילה בסביבת הבדיקה"
      >
        <span className="do-google-mark" aria-hidden="true">G</span>
        <span>המשך עם Google</span>
      </button>
      <small id="do-google-readiness" className="do-auth-provider-readiness">לא זמין בסביבת הבדיקה</small>
      {verificationRequired ? <Link className="do-auth-verify-link" href="/digital-observer/verify">אימות קוד או שליחה חוזרת</Link> : null}
      <p className="do-auth-switch">אין לכם חשבון? <Link href="/digital-observer/register">יצירת חשבון</Link></p>
      <Link className="do-link" href="/digital-observer">חזרה לאתר התצפיתן</Link>
    </form>
  );
}
