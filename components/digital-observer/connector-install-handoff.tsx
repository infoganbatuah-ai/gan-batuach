"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";
import { installerPlatform } from "@/lib/domain/digital-observer/connector-installation";
import type { ConnectivityFamilyId } from "@/lib/domain/digital-observer/connectivity-registry";

async function post(path: string, payload: unknown, isCurrent: () => boolean) {
  if (!isCurrent()) return null;
  const token = readObserverAccessToken();
  const response = await fetch(path, { method: "POST", cache: "no-store", credentials: "same-origin",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
  if (!isCurrent()) return null;
  const body = await response.json();
  if (!isCurrent()) return null;
  if (!response.ok) throw new Error("INSTALLATION_UNAVAILABLE");
  return body.data;
}
type InstallStatus = { stage: string; enrollment_id: string | null; expires_at: string };
type InstallerManifest = { available: boolean; platform?: string; filename?: string; download_path?: string; reason?: string };

type InstallHandoffProps = {
  siteId: string; family: ConnectivityFamilyId; onOnline: (intentId: string) => void; initialIntent?: string;
  onProductAction?: () => void; onInstallerAction?: () => void; onFailure?: (category: "INSTALLER_UNAVAILABLE" | "ENROLLMENT_EXPIRED") => void;
};

export function ConnectorInstallHandoff(props: InstallHandoffProps) {
  return <ScopedInstallHandoff key={`${props.siteId}:${props.family}:${props.initialIntent ?? ""}`} {...props} />;
}

function ScopedInstallHandoff({ siteId, family, onOnline, initialIntent, onProductAction, onInstallerAction, onFailure }: InstallHandoffProps) {
  const [intent, setIntent] = useState(initialIntent ?? "");
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lifetime = useRef({ active: true, intent: initialIntent ?? "", status: null as InstallStatus | null,
    busy: false, flow: 0, refresh: 0, releases: new Set<() => void>() });

  useEffect(() => {
    const owner = lifetime.current;
    owner.active = true;
    return () => {
      owner.active = false;
      owner.flow++;
      owner.refresh++;
      owner.status = null;
      for (const release of [...owner.releases]) release();
    };
  }, []);
  const detectedPlatform = typeof navigator === "undefined" ? "UNSUPPORTED" : installerPlatform(navigator.userAgent);
  const refresh = useCallback(async (parentIsCurrent?: () => boolean) => {
    const owner = lifetime.current;
    if (!owner.active || !intent || owner.intent !== intent || (parentIsCurrent ? !parentIsCurrent() : owner.busy)) return;
    const generation = ++owner.refresh;
    const isCurrent = () => owner.active && owner.intent === intent && generation === owner.refresh && (!parentIsCurrent || parentIsCurrent());
    try {
      const next = await post("/api/digital-observer/connector-installation", { action: "status", observer_site_id: siteId, intent_id: intent }, isCurrent);
      if (!isCurrent()) return;
      owner.status = next;
      setStatus(next); setError("");
      if (next.stage === "CONNECTOR_FOUND") onOnline(intent);
    } catch { if (isCurrent()) setError("לא ניתן לקרוא את מצב ההתקנה. ודאו שאתם מחוברים לחשבון שבו התחלתם ונסו שוב."); }
  }, [intent, siteId, onOnline]);
  useEffect(() => {
    if (!intent) return;
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => { if (lifetime.current.active && !lifetime.current.busy && !document.hidden && !busy) void refresh(); }, 5000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [intent, refresh, busy]);

  function downloadUrl(file: File, isCurrent: () => boolean) {
    if (!isCurrent()) return null;
    const owner = lifetime.current;
    const objectUrl = URL.createObjectURL(file);
    if (!isCurrent()) { URL.revokeObjectURL(objectUrl); return null; }
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      clearTimeout(timer);
      owner.releases.delete(release);
      try { URL.revokeObjectURL(objectUrl); } catch { /* Best-effort cleanup, no retries. */ }
    };
    const timer = setTimeout(release, 1000);
    owner.releases.add(release);
    return objectUrl;
  }

  async function begin(selectedPlatform?: "macos-arm64" | "windows-x64") {
    const owner = lifetime.current;
    if (!owner.active || owner.busy || owner.intent !== intent) return;
    owner.busy = true;
    const generation = ++owner.flow;
    owner.refresh++;
    let ownedIntent = intent;
    const isCurrent = () => owner.active && generation === owner.flow && owner.intent === ownedIntent;
    try {
      onProductAction?.();
      if (!isCurrent()) return;
      setBusy(true); setError("");
      if (detectedPlatform === "UNSUPPORTED") throw new Error("UNSUPPORTED_PLATFORM");
      // A phone is a setup surface, never an assumed bridge or desktop. The
      // customer explicitly chooses the computer that will receive the package.
      const platform = selectedPlatform ?? (detectedPlatform === "WINDOWS" ? "windows-x64"
        : detectedPlatform === "MACOS" ? "macos-arm64" : null);
      if (!platform) throw new Error("COMPUTER_PLATFORM_REQUIRED");
      const manifestResponse = await fetch(`/api/digital-observer/connector-installation?action=manifest&observer_site_id=${encodeURIComponent(siteId)}&family=${encodeURIComponent(family)}&platform=${platform}`, {
        cache: "no-store", credentials: "same-origin", headers: readObserverAccessToken() ? { authorization: `Bearer ${readObserverAccessToken()}` } : {}
      });
      if (!isCurrent()) return;
      const manifestBody = await manifestResponse.json().catch(() => ({}));
      if (!isCurrent()) return;
      const manifest = manifestBody.data as InstallerManifest | undefined;
      if (!manifestResponse.ok || !manifest?.available || !manifest.download_path) throw new Error(manifest?.reason || "INSTALLER_UNAVAILABLE");
      const data = await post("/api/digital-observer/connector-installation", { action: "create", observer_site_id: siteId, family }, isCurrent);
      if (!isCurrent()) return;
      ownedIntent = data.document.intent_id;
      owner.intent = ownedIntent;
      owner.status = null;
      owner.refresh++;
      setIntent(ownedIntent);
      setStatus(null);
      const url = new URL(window.location.href); url.searchParams.set("install_intent", data.document.intent_id);
      history.replaceState(null, "", url); // UUID only; no enrollment secret in URL/history.
      if (!isCurrent()) return;
      const file = new File([JSON.stringify(data.document)], "Digital Observer.observer-connect", { type: "application/vnd.digital-observer.connect+json" });
      if (!isCurrent()) return;
      if (detectedPlatform === "MOBILE" && navigator.canShare?.({ files: [file] })) {
        if (!isCurrent()) return;
        await navigator.share({ files: [file], title: "חיבור המחשב ל-Digital Observer",
          text: "פתחו קובץ זה במחשב לאחר התקנת Digital Observer. הקישור חד-פעמי ופג במהירות." });
        if (!isCurrent()) return;
        // The installer endpoint is authenticated and carries no enrollment
        // secret. Opening it on the computer requires the same authorized account.
        window.open(manifest.download_path, "_blank", "noopener,noreferrer");
        if (isCurrent()) onInstallerAction?.();
      }
      else {
        const objectUrl = downloadUrl(file, isCurrent);
        if (!isCurrent() || objectUrl === null) return;
        const link = document.createElement("a");
        if (!isCurrent()) return;
        link.href = objectUrl; link.download = file.name; link.click();
        if (!isCurrent()) return;
        const installer = document.createElement("a"); installer.href = manifest.download_path;
        if (!isCurrent()) return;
        installer.download = manifest.filename || "Digital-Observer-Connector"; installer.click();
        if (isCurrent()) onInstallerAction?.();
      }
    } catch {
      if (!isCurrent()) return;
      onFailure?.("INSTALLER_UNAVAILABLE");
      if (isCurrent()) setError("לא ניתן להתחיל את ההתקנה כעת. אפשר לנסות שוב; אין צורך ליצור בית חדש.");
    }
    finally { if (isCurrent()) { owner.busy = false; setBusy(false); } }
  }
  async function confirm() {
    const owner = lifetime.current;
    if (!owner.active || owner.busy || owner.intent !== intent || !status?.enrollment_id || owner.status !== status) return;
    owner.busy = true;
    owner.status = null;
    const generation = ++owner.flow;
    owner.refresh++;
    const isCurrent = () => owner.active && owner.intent === intent && generation === owner.flow;
    try {
      onProductAction?.();
      if (!isCurrent()) return;
      setBusy(true);
      await post("/api/digital-observer/gateway-enrollment", { action: "approve", enrollment_request_id: status.enrollment_id, observer_site_id: siteId }, isCurrent);
      if (!isCurrent()) return;
      await refresh(isCurrent);
    } catch {
      if (!isCurrent()) return;
      onFailure?.("ENROLLMENT_EXPIRED");
      if (isCurrent()) setError("אישור המחשב לא הושלם. חזרו לחשבון שבו התחלתם ובדקו שתוקף הבקשה לא פג.");
    }
    finally { if (isCurrent()) { owner.busy = false; setBusy(false); } }
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
