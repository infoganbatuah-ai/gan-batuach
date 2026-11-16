"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { currentNativePushDeviceId } from "@/lib/domain/digital-observer/native-push-logout";

export function LogoutButton({
  compact = false,
  redirectTo = "/login",
  className
}: {
  compact?: boolean;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const deviceId = redirectTo === "/digital-observer/login" ? await currentNativePushDeviceId() : null;
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        ...(deviceId ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ observer_push_device_id: deviceId }) } : {})
      });
      if (!response.ok) {
        const result = deviceId && response.status === 503
          ? await response.json().catch(() => null)
          : null;
        if (result?.error === "PUSH_REVOCATION_FAILED") {
          setError("לא ניתן לבטל את התראות המכשיר, לכן נשארת מחובר/ת. בדוק את החיבור ונסה להתנתק שוב. אם הבעיה חוזרת, פנה לתמיכה.");
          return;
        }
        throw new Error("LOGOUT_FAILED");
      }
      window.sessionStorage.removeItem("digital_observer_session_access");
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("ההתנתקות לא הושלמה. בדוק את החיבור ונסה שוב.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
    <button
      className={className ?? `button secondary tiny logout-button${compact ? " compact" : ""}`}
      type="button"
      onClick={logout}
      disabled={busy}
      title="התנתקות"
      aria-label="התנתקות"
    >
      <LogOut size={19} />
      <span>התנתקות</span>
    </button>
    {error ? <span role="alert">{error}</span> : null}
    </>
  );
}
