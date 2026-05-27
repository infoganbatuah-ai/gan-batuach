"use client";

import { useState } from "react";

function reasonText(reason: string) {
  const map: Record<string, string> = {
    allowed: "יש הרשאת צפייה",
    parent_profile_not_found: "לא נמצא פרופיל הורה",
    parent_record_not_found: "הפרופיל לא מחובר לרשומת הורה",
    parent_not_linked_to_child: "הורה לא משויך לילד",
    camera_not_found: "המצלמה לא נמצאה",
    camera_has_no_garden_id: "למצלמה אין שיוך גן",
    child_camera_garden_mismatch: "הילד משויך לגן אחר מהמצלמה",
    parent_viewing_not_enabled: "צפיית הורים לא הופעלה במצלמה",
    camera_inactive_or_disabled: "המצלמה כבויה או לא פעילה",
    camera_has_no_parent_playback_source: "אין מקור צפייה להורים או סטטוס מתאים",
    camera_query_failed: "בדיקת המצלמה נכשלה",
    parent_profile_query_failed: "בדיקת פרופיל ההורה נכשלה"
  };
  return map[reason] ?? reason;
}

export function ParentCameraAccessDebug({ cameraId }: { cameraId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkAccess() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/debug/parent-camera-access?camera_id=${encodeURIComponent(cameraId)}&email=${encodeURIComponent(email)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "בדיקת הגישה נכשלה");
      setResult(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "בדיקת הגישה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  const diagnostics = result?.diagnostics;

  return (
    <div className="camera-admin-access-debug">
      <label>
        בדיקת גישת הורה
        <div className="inline-action-row">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="parent@example.com" />
          <button className="button secondary tiny" type="button" disabled={busy || !email.trim()} onClick={checkAccess}>{busy ? "בודק..." : "בדיקה"}</button>
        </div>
      </label>
      {error ? <small className="error-text">{error}</small> : null}
      {result ? (
        <div className={result.allowed ? "access-debug-result good" : "access-debug-result warn"}>
          <strong>{result.allowed ? "ההורה יכול לצפות במצלמה" : "אין גישת הורה למצלמה"}</strong>
          <span>סיבה: {reasonText(result.reason)}</span>
          {diagnostics ? (
            <div className="access-debug-grid">
              <span>פרופיל: {diagnostics.parent_profile_found ? "נמצא" : "לא נמצא"}</span>
              <span>רשומות הורה: {diagnostics.parent_records_found?.length ?? 0}</span>
              <span>ילדים משויכים: {diagnostics.linked_children_found?.length ?? 0}</span>
              <span>גני ילדים: {(diagnostics.child_garden_ids ?? []).join(", ") || "-"}</span>
              <span>גן מצלמה: {diagnostics.camera_garden_id ?? "-"}</span>
              <span>צפיית הורים: {diagnostics.parent_viewing_enabled ? "פעילה" : "כבויה"}</span>
              <span>Sample HLS: {diagnostics.sample_hls_url_exists ? "קיים" : "חסר"}</span>
              <span>סטטוס: {diagnostics.status ?? "-"}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
