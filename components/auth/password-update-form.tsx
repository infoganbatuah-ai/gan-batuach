"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export function PasswordUpdateForm({
  product,
  loginHref,
  requestHref
}: {
  product: "gan_batuach" | "digital_observer";
  loginHref: string;
  requestHref: string;
}) {
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setSessionReady(true);
    });
    void supabase.auth.getUser().then(({ data }) => setSessionReady(Boolean(data.user)));
    return () => subscription.data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");
    if (password.length < 10 || password !== confirmation) {
      setMessage("הסיסמה חייבת לכלול לפחות 10 תווים ושני השדות חייבים להיות זהים.");
      return;
    }
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const result = await supabase.auth.updateUser({ password });
    if (result.error) {
      setMessage("לא ניתן לעדכן את הסיסמה. בקשו קישור חדש והשתמשו במייל האחרון בלבד.");
      setBusy(false);
      return;
    }
    window.sessionStorage.removeItem("auth_recovery_ready");
    await supabase.auth.signOut({ scope: "local" });
    setSaved(true);
    setSessionReady(false);
    setBusy(false);
  }

  if (sessionReady === null) return <div className="do-action-result loading"><LoaderCircle className="do-spin" /> בודקים את קישור השחזור...</div>;
  if (saved) return <div className="do-page-stack"><div className="do-notice good"><CheckCircle2 /><span>הסיסמה נשמרה והקישור נוצל. אפשר להתחבר עם הסיסמה החדשה.</span></div><Link className="do-button primary full" href={`${loginHref}${loginHref.includes("?") ? "&" : "?"}password_updated=1`}>מעבר להתחברות</Link></div>;
  if (!sessionReady) return <div className="do-page-stack"><div className="do-notice warn"><LockKeyhole /><span>קישור השחזור חסר, כבר נוצל או שפג תוקפו.</span></div><Link className="do-button primary full" href={requestHref}>שליחת קישור חדש</Link><Link className="do-button secondary full" href={loginHref}>חזרה להתחברות</Link></div>;

  return <form className="do-page-stack" onSubmit={submit}>
    <label className="do-field"><span>סיסמה חדשה</span><span className="do-password-field"><input name="password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} required disabled={busy} /><button type="button" className="do-password-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? "הסתרת סיסמה" : "הצגת סיסמה"}>{visible ? <EyeOff /> : <Eye />}</button></span><small>לפחות 10 תווים. הסיסמה נשמרת ב-Supabase ואינה נכתבת בדוחות.</small></label>
    <label className="do-field"><span>אימות סיסמה</span><input name="password_confirmation" type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} required disabled={busy} /></label>
    {message ? <div className="do-notice bad" role="alert"><LockKeyhole /><span>{message}</span></div> : null}
    <button className="do-button primary full" type="submit" disabled={busy}>{busy ? <LoaderCircle className="do-spin" /> : <LockKeyhole />}{busy ? "שומרים..." : "שמירת סיסמה"}</button>
    <input type="hidden" name="product" value={product} />
  </form>;
}
