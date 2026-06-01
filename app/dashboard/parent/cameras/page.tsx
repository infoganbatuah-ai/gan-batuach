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
  const { cameras, debug, scope } = result;

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
          <p>כאן מופיעות רק מצלמות שהגן אישר לצפיית הורים. הצפייה נפתחת בצורה מאובטחת ולזמן מוגבל.</p>
        </div>
        <span className={gatewayConnected ? "pill good" : "pill warn"}>{gatewayConnected ? "מחובר" : "ממתין לחיבור שידור"}</span>
      </div>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <ShieldCheck />
          <h2>פרטיות</h2>
          <p>אין גישה למצלמות של גנים אחרים או למצלמות שלא אושרו לצפיית הורים.</p>
        </article>
        <article className="card action-panel">
          <Camera />
          <h2>צפייה מאובטחת</h2>
          <p>כל צפייה נפתחת לזמן מוגבל ומתועדת לצורכי פרטיות ובטיחות.</p>
        </article>
        <article className="card action-panel">
          <h2>חלונות צפייה</h2>
          <p>הגן יכול להגדיר שעות ותוקף הרשאה לכל מצלמה.</p>
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
              {group.cameras.map((camera) => <CameraPlaybackCard camera={camera} parentId={scope.parentIds[0]} parentView key={camera.id} />)}
            </div>
          </section>
        ))}
      </section>
    </DashboardShell>
  );
}
