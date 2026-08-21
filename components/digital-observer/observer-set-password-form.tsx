"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export function ObserverSetPasswordForm() {
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setSessionReady(Boolean(data.user)));
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
    const supabase = createClient();
    const result = await supabase.auth.updateUser({ password });
    if (result.error) {
      setMessage("לא ניתן לעדכן את הסיסמה. בקשו קישור חדש ונסו שוב.");
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    setMessage("הסיסמה נשמרה. אפשר להתחבר למרכז הבקרה.");
    setBusy(false);
    setSessionReady(false);
  }

  if (sessionReady === null) return <div className="do-action-result"><LoaderCircle className="do-spin" /> בודקים את קישור ההגדרה...</div>;
  if (!sessionReady && message.includes("נשמרה")) return <div className="do-page-stack"><div className="do-notice good"><CheckCircle2 /><span>{message}</span></div><Link className="do-button primary full" href="/digital-observer/login?next=/digital-observer/admin">כניסה למרכז הבקרה</Link></div>;
  if (!sessionReady) return <div className="do-page-stack"><div className="do-notice warn"><LockKeyhole /><span>קישור ההגדרה חסר, אינו תקף או שפג תוקפו.</span></div><Link className="do-button secondary full" href="/digital-observer/login">חזרה להתחברות</Link></div>;

  return <form className="do-page-stack" onSubmit={submit}><label className="do-field"><span>סיסמה חדשה</span><input name="password" type="password" autoComplete="new-password" minLength={10} required disabled={busy} /></label><label className="do-field"><span>אימות סיסמה</span><input name="password_confirmation" type="password" autoComplete="new-password" minLength={10} required disabled={busy} /></label>{message ? <div className="do-notice bad"><LockKeyhole /><span>{message}</span></div> : null}<button className="do-button primary full" type="submit" disabled={busy}>{busy ? <LoaderCircle className="do-spin" /> : <LockKeyhole />}{busy ? "שומרים..." : "שמירת סיסמה"}</button></form>;
}
