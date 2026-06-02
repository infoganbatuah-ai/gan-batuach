"use client";

import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type ApiResponse<T> = T & { error?: string };

type PasskeyListResponse = {
  data: Array<{ id: string; label?: string | null; created_at?: string | null }>;
};

type RegistrationOptionsResponse = {
  options: Parameters<typeof startRegistration>[0]["optionsJSON"];
};

export function PasskeyEnrollmentPrompt() {
  const [isSupported, setIsSupported] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(browserSupportsWebAuthn());
    fetch("/api/passkeys")
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as PasskeyListResponse;
        setHasPasskey((body.data ?? []).length > 0);
      })
      .catch(() => undefined);
  }, []);

  if (!isSupported || hasPasskey) return null;

  async function enablePasskey() {
    setIsLoading(true);
    setMessage("פותחים את חלון האישור של המכשיר...");

    try {
      const optionsResponse = await fetch("/api/passkeys/register/options", { method: "POST" });
      const optionsBody = (await optionsResponse.json()) as ApiResponse<RegistrationOptionsResponse>;
      if (!optionsResponse.ok) throw new Error(optionsBody.error || "לא ניתן להתחיל הפעלת Passkey.");

      const response = await startRegistration({ optionsJSON: optionsBody.options });
      const verifyResponse = await fetch("/api/passkeys/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, label: "המכשיר האישי שלי" })
      });
      const verifyBody = (await verifyResponse.json()) as ApiResponse<{ ok: boolean }>;
      if (!verifyResponse.ok) throw new Error(verifyBody.error || "לא ניתן לשמור את ה־Passkey.");

      setHasPasskey(true);
      setMessage("כניסה מהירה הופעלה בהצלחה למכשיר הזה.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "הפעלת Passkey נכשלה. אפשר לנסות שוב מאוחר יותר.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <aside className="passkey-enroll-card">
      <div className="passkey-title compact-title">
        <span className="passkey-icon"><ShieldCheck size={19} /></span>
        <div>
          <strong>כניסה מהירה</strong>
          <span>Face ID / Touch ID / טביעת אצבע</span>
        </div>
      </div>
      <p>הפעל לאחר כניסה רגילה. לא נשמרים נתונים ביומטריים בשרת.</p>
      <button className="button tiny" type="button" onClick={enablePasskey} disabled={isLoading}>
        <Fingerprint size={16} /> {isLoading ? "מפעילים..." : "הפעל במכשיר הזה"}
      </button>
      {message ? <small>{message}</small> : null}
    </aside>
  );
}
