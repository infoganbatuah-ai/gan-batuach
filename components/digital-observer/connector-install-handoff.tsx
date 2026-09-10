"use client";
import { useCallback, useEffect, useState } from "react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";
import { installerPlatform } from "@/lib/domain/digital-observer/connector-installation";
import type { ConnectivityFamilyId } from "@/lib/domain/digital-observer/connectivity-registry";

async function post(path: string, payload: unknown) {
  const token = readObserverAccessToken();
  const response = await fetch(path, { method: "POST", cache: "no-store", credentials: "same-origin",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error("INSTALLATION_UNAVAILABLE");
  return body.data;
}
type InstallStatus = { stage: string; enrollment_id: string | null; expires_at: string };
type InstallerManifest = { available: boolean; platform?: string; filename?: string; download_path?: string; reason?: string };

export function ConnectorInstallHandoff({ siteId, family, onOnline, initialIntent, onProductAction, onInstallerAction, onFailure }: {
  siteId: string; family: ConnectivityFamilyId; onOnline: (intentId: string) => void; initialIntent?: string;
  onProductAction?: () => void; onInstallerAction?: () => void; onFailure?: (category: "INSTALLER_UNAVAILABLE" | "ENROLLMENT_EXPIRED") => void;
}) {
  const [intent, setIntent] = useState(initialIntent ?? "");
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const detectedPlatform = typeof navigator === "undefined" ? "UNSUPPORTED" : installerPlatform(navigator.userAgent);
  const refresh = useCallback(async () => {
    if (!intent) return;
    try {
      const next = await post("/api/digital-observer/connector-installation", { action: "status", observer_site_id: siteId, intent_id: intent });
      setStatus(next); setError("");
      if (next.stage === "CONNECTOR_FOUND") onOnline(intent);
    } catch { setError("לא ניתן לקרוא את מצב ההתקנה. ודאו שאתם מחוברים לחשבון שבו התחלתם ונסו שוב."); }
  }, [intent, siteId, onOnline]);
  useEffect(() => {
    if (!intent) return;
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => { if (!document.hidden && !busy) void refresh(); }, 5000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [intent, refresh, busy]);
  async function begin(selectedPlatform?: "macos-arm64" | "windows-x64") {
    onProductAction?.();
    setBusy(true); setError("");
    try {
      if (detectedPlatform === "UNSUPPORTED") throw new Error("UNSUPPORTED_PLATFORM");
      // A phone is a setup surface, never an assumed bridge or desktop. The
      // customer explicitly chooses the computer that will receive the package.
      const platform = selectedPlatform ?? (detectedPlatform === "WINDOWS" ? "windows-x64"
        : detectedPlatform === "MACOS" ? "macos-arm64" : null);
      if (!platform) throw new Error("COMPUTER_PLATFORM_REQUIRED");
      const manifestResponse = await fetch(`/api/digital-observer/connector-installation?action=manifest&observer_site_id=${encodeURIComponent(siteId)}&family=${encodeURIComponent(family)}&platform=${platform}`, {
        cache: "no-store", credentials: "same-origin", headers: readObserverAccessToken() ? { authorization: `Bearer ${readObserverAccessToken()}` } : {}
      });
      const manifestBody = await manifestResponse.json().catch(() => ({}));
      const manifest = manifestBody.data as InstallerManifest | undefined;
      if (!manifestResponse.ok || !manifest?.available || !manifest.download_path) throw new Error(manifest?.reason || "INSTALLER_UNAVAILABLE");
      const data = await post("/api/digital-observer/connector-installation", { action: "create", observer_site_id: siteId, family });
      setIntent(data.document.intent_id);
      const url = new URL(window.location.href); url.searchParams.set("install_intent", data.document.intent_id);
      history.replaceState(null, "", url); // UUID only; no enrollment secret in URL/history.
      const file = new File([JSON.stringify(data.document)], "Digital Observer.observer-connect", { type: "application/vnd.digital-observer.connect+json" });
      if (detectedPlatform === "MOBILE" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "חיבור המחשב ל-Digital Observer",
          text: "פתחו קובץ זה במחשב לאחר התקנת Digital Observer. הקישור חד-פעמי ופג במהירות." });
        // The installer endpoint is authenticated and carries no enrollment
        // secret. Opening it on the computer requires the same authorized account.
        window.open(manifest.download_path, "_blank", "noopener,noreferrer");
        onInstallerAction?.();
      }
      else {
        const objectUrl = URL.createObjectURL(file); const link = document.createElement("a");
        link.href = objectUrl; link.download = file.name; link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        const installer = document.createElement("a"); installer.href = manifest.download_path;
        installer.download = manifest.filename || "Digital-Observer-Connector"; installer.click();
        onInstallerAction?.();
      }
    } catch { onFailure?.("INSTALLER_UNAVAILABLE"); setError("לא ניתן להתחיל את ההתקנה כעת. אפשר לנסות שוב; אין צורך ליצור בית חדש."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!status?.enrollment_id) return;
    onProductAction?.();
    setBusy(true);
    try {
      await post("/api/digital-observer/gateway-enrollment", { action: "approve", enrollment_request_id: status.enrollment_id, observer_site_id: siteId });
      await refresh();
    } catch { onFailure?.("ENROLLMENT_EXPIRED"); setError("אישור המחשב לא הושלם. חזרו לחשבון שבו התחלתם ובדקו שתוקף הבקשה לא פג."); }
    finally { setBusy(false); }
  }
  return <section className="do-panel do-form-section" aria-live="polite">
    <h3>חיבור המחשב לבית</h3>
    <p>לחיצה אחת מורידה את אפליקציית החיבור ואת בקשת הקישור הקצרה. פתחו את האפליקציה ואת בקשת הקישור; אין להעתיק מזהים או סיסמאות.</p>
    {!intent || status?.stage === "EXPIRED" ? detectedPlatform === "MOBILE" ? <div className="do-button-row" role="group" aria-label="בחירת המחשב להתקנת רכיב החיבור">
      <button type="button" className="do-button secondary" disabled={busy} onClick={() => void begin("macos-arm64")}>שליחה ל‑Mac</button>
      <button type="button" className="do-button secondary" disabled={busy} onClick={() => void begin("windows-x64")}>שליחה ל‑Windows</button>
    </div> : <button type="button" className="do-button secondary" disabled={busy} onClick={() => void begin()}>
      התקן והמשך
    </button> : <p>{status?.stage === "CONFIRM_COMPUTER" ? "המחשב נמצא. אשרו רק אם פתחתם בו כעת את בקשת ההתקנה." : status?.stage === "REVOKED" ? "הקישור בוטל. יש להתחיל בקשה מורשית חדשה." : "מחכים לרכיב החיבור…"}</p>}
    {status?.stage === "CONFIRM_COMPUTER" ? <button type="button" className="do-button primary" disabled={busy} onClick={() => void confirm()}>אישור חיבור המחשב לבית הזה</button> : null}
    {error ? <div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => void refresh()}>נסה שוב</button></div> : null}
  </section>;
}
