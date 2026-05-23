"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound } from "lucide-react";
import { useState } from "react";

type ApiResponse<T> = T & { error?: string };

type AuthenticationOptionsResponse = {
  options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
};

type AuthenticationVerifyResponse = {
  ok: boolean;
  redirectTo: string;
};

export function PasskeyLogin() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loginWithPasskey() {
    setIsLoading(true);
    setStatus("פותחים בדיקת Face ID / Touch ID במכשיר...");

    try {
      const optionsResponse = await fetch("/api/passkeys/authenticate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const optionsBody = (await optionsResponse.json()) as ApiResponse<AuthenticationOptionsResponse>;
      if (!optionsResponse.ok) throw new Error(optionsBody.error || "לא ניתן להתחיל כניסה מהירה.");

      const response = await startAuthentication({ optionsJSON: optionsBody.options });
      const verifyResponse = await fetch("/api/passkeys/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, response })
      });
      const verifyBody = (await verifyResponse.json()) as ApiResponse<AuthenticationVerifyResponse>;
      if (!verifyResponse.ok) throw new Error(verifyBody.error || "אימות הכניסה נכשל.");

      setStatus("הכניסה אושרה. מעבירים אותך לדשבורד...");
      window.location.assign(verifyBody.redirectTo || "/dashboard");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "כניסה מהירה נכשלה. אפשר להיכנס עם סיסמה.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="card form passkey-card" aria-label="כניסה מהירה עם Passkey">
      <div className="passkey-title">
        <span className="passkey-icon"><Fingerprint size={22} /></span>
        <div>
          <h2>כניסה מהירה עם Face ID / טביעת אצבע</h2>
          <p>הזיהוי מתבצע במכשיר שלך. גן בטוח שומרת רק מפתח ציבורי מאובטח, לא נתונים ביומטריים.</p>
        </div>
      </div>
      <label>אימייל לחשבון<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username webauthn" placeholder="name@example.com" /></label>
      <button className="button soft" type="button" onClick={loginWithPasskey} disabled={isLoading || !email}>
        <KeyRound size={18} /> {isLoading ? "ממתין לאישור במכשיר" : "כניסה עם Passkey"}
      </button>
      {status ? <p className="notice compact">{status}</p> : <p className="muted-small">תמיד אפשר להמשיך להיכנס בסיסמה אם המכשיר לא זמין.</p>}
    </section>
  );
}
