import { Camera, ShieldCheck } from "lucide-react";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { getParentCameraListForProfile } from "@/lib/domain/parent-camera-list";
import { createClient } from "@/lib/supabase/server";

type GardenGroup = { id: string; name: string; cameras: any[] };

function emptyState(kind: "no_relation" | "no_cameras" | "not_allowed") {
  if (kind === "no_relation") return { title: "לא נמצא שיוך לגן עבור המשתמש הזה", body: "כדי להציג מצלמות, ההורה צריך להיות משויך ישירות לגן או דרך כרטיס ילד. פנו למנהלת הגן לבדוק את שיוך ההורה." };
  if (kind === "no_cameras") return { title: "הורה משויך לגן, אך לא נמצאו מצלמות מורשות לצפייה", body: "נמצא שיוך לגן, אך עדיין אין מצלמות רשומות או זמינות לצפיית הורים עבור הגן הזה." };
  return { title: "המצלמות קיימות אך צפיית הורים לא הופעלה", body: "מנהלת הגן צריכה להפעיל צפיית הורים עבור המצלמה לפני שהיא תופיע כאן." };
}

export default async function Page() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const result = await getParentCameraListForProfile(supabase as any, profile);
  const { cameras, debug, decisions, scope } = result;

  const gardenNameById = new Map<string, string>();
  for (const child of scope.children as any[]) {
    const gardenId = child.garden_id ?? child.kindergarten_id;
    const gardenName = child.gardens?.name;
    if (gardenId && gardenName) gardenNameById.set(gardenId, gardenName);
  }

  const groups = debug.allowedKindergartenIds.map((gardenId) => {
    return {
      id: gardenId,
      name: gardenNameById.get(gardenId) ?? "גן ילדים",
      cameras: cameras.filter((camera) => camera.camera_garden_id === gardenId)
    } satisfies GardenGroup;
  }).filter((group) => group.cameras.length > 0);

  const gatewayConnected = Boolean(process.env.VIDEO_GATEWAY_URL);
  const empty = !debug.allowedKindergartenIds.length ? emptyState("no_relation") : debug.candidateCamerasCount === 0 ? emptyState("no_cameras") : emptyState("not_allowed");

  return (
    <DashboardShell role="parent" title="מצלמות הגן">
      <div className="dashboard-hero-card parent-hero-card">
        <div>
          <p className="eyebrow">צפייה מורשית בלבד</p>
          <h1>מצלמות הגן.</h1>
          <p>הורה רואה רק מצלמות של הגן שאליו הוא משויך ורק מצלמות שהגן סימן כמותרות לצפיית הורים. פרטי RTSP, שם משתמש וסיסמאות לא נשלחים לדפדפן.</p>
        </div>
        <span className={gatewayConnected ? "pill good" : "pill warn"}>{gatewayConnected ? "Gateway מחובר" : "Sample HLS / Gateway"}</span>
      </div>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <ShieldCheck />
          <h2>פרטיות</h2>
          <p>אין גישה למצלמות של גנים אחרים או למצלמות שלא אושרו להורים.</p>
        </article>
        <article className="card action-panel">
          <Camera />
          <h2>Token זמני</h2>
          <p>כל פתיחת צפייה יוצרת Session זמני ומתועד.</p>
        </article>
        <article className="card action-panel">
          <h2>חלונות צפייה</h2>
          <p>הגן יכול להגדיר שעות ותוקף הרשאה לכל מצלמה.</p>
        </article>
      </section>

      <section className="dashboard-section">
        <article className="card camera-debug-card">
          <div className="section-heading">
            <h2>אבחון זמני - מצלמות הורה</h2>
            <p>הדף משתמש עכשיו באותה שכבת הרשאות שרתית כמו בדיקת האדמין, ולא קורא ישירות את הטבלה מהדפדפן.</p>
          </div>
          <div className="access-debug-grid">
            <span>Parent profile id: {profile.id}</span>
            <span>Parent record id: {scope.parentIds.join(", ") || "-"}</span>
            <span>Allowed kindergarten ids: {debug.allowedKindergartenIds.join(", ") || "-"}</span>
            <span>Data source: {debug.dataSource}</span>
            <span>Service role configured: {String(debug.serviceRoleConfigured)}</span>
            <span>garden_id query returned: {debug.gardenIdQueryCount}</span>
            <span>kindergarten_id query returned: {debug.kindergartenIdQueryCount}</span>
            <span>Candidate cameras count: {debug.candidateCamerasCount}</span>
            <span>Candidate camera ids: {debug.candidateCameraIds.join(", ") || "-"}</span>
            <span>Allowed cameras count: {debug.allowedCamerasCount}</span>
            <span>Allowed camera ids: {debug.allowedCameraIds.join(", ") || "-"}</span>
            <span>Allowed cameras missing playback source: {debug.missingPlaybackSourceCount}</span>
            <span>Cameras hidden because status: {debug.hiddenBecauseStatus}</span>
            <span>Cameras hidden because parent viewing flag: {debug.hiddenBecauseParentViewingFlag}</span>
          </div>
          {debug.queryErrors.length ? (
            <div className="gateway-setup-state">
              <strong>חלק משאילתות המצלמה נחסמו או נכשלו</strong>
              <p>{debug.queryErrors.map((item) => `${item.query}: ${item.message}`).join(" | ")}</p>
            </div>
          ) : null}
          {decisions.length === 0 ? <div className="empty-mini">לא נמצאו מצלמות לבדיקה בדף ההורה.</div> : decisions.map((decision) => (
            <article className="camera-debug-row" key={decision.diagnostics.camera_id ?? decision.reason}>
              <strong>{decision.allowed ? "ALLOW" : "DENY"}: {decision.diagnostics.camera_name ?? "מצלמה"}</strong>
              <span>reason: {decision.reason}</span>
              <div className="access-debug-grid">
                <span>camera id: {decision.diagnostics.camera_id ?? "-"}</span>
                <span>active: {String(decision.diagnostics.active)}</span>
                <span>status: {decision.diagnostics.status ?? "-"}</span>
                <span>parent_view_allowed: {String(decision.diagnostics.parent_view_allowed)}</span>
                <span>parent_viewing_allowed: {String(decision.diagnostics.parent_viewing_allowed)}</span>
                <span>garden_id: {decision.diagnostics.camera_garden_id_fields.garden_id ?? "-"}</span>
                <span>kindergarten_id: {decision.diagnostics.camera_garden_id_fields.kindergarten_id ?? "-"}</span>
                <span>sample_hls_url: {decision.diagnostics.sample_hls_url_exists ? "exists" : "missing"}</span>
                <span>hls_playback_url: {decision.diagnostics.hls_playback_url_exists ? "exists" : "missing"}</span>
                <span>webrtc_playback_url: {decision.diagnostics.webrtc_playback_url_exists ? "exists" : "missing"}</span>
                <span>gateway_stream_id: {decision.diagnostics.gateway_stream_id_exists ? "exists" : "missing"}</span>
              </div>
            </article>
          ))}
        </article>
      </section>

      <section className="dashboard-section">
        {groups.length === 0 ? (
          <div className="empty-state">
            <strong>{empty.title}</strong>
            <span>{empty.body}</span>
          </div>
        ) : groups.map((group) => (
          <section className="dashboard-section" key={group.id}>
            <div className="section-heading">
              <h2>{group.name}</h2>
              <p>{group.cameras.length} מצלמות מאושרות לצפיית הורים.</p>
            </div>
            <div className="camera-playback-grid">
              {group.cameras.map((camera) => <CameraPlaybackCard camera={camera} parentId={scope.parentIds[0]} key={camera.id} />)}
            </div>
          </section>
        ))}
      </section>
    </DashboardShell>
  );
}
