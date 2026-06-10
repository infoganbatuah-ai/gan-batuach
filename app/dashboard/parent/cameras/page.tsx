import { Camera, ShieldCheck } from "lucide-react";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { getParentCameraListForProfile } from "@/lib/domain/parent-camera-list";
import { createClient } from "@/lib/supabase/server";

type GardenGroup = { id: string; name: string; cameras: any[] };

function emptyState(kind: "no_relation" | "no_cameras" | "not_allowed") {
  if (kind === "no_relation") return { title: "עדיין אין שיוך לגן", body: "לאחר שהגן יאשר את הילד, צפייה שאושרה להורים תופיע כאן." };
  if (kind === "no_cameras") return { title: "אין צפייה זמינה כרגע", body: "הגן עדיין לא פתח מצלמות לצפיית הורים. כשתהיה צפייה מאושרת, היא תופיע כאן." };
  return { title: "הצפייה עדיין לא נפתחה", body: "הגן בוחר אילו מצלמות וזמנים פתוחים להורים. כשההרשאה תיפתח, תראו אותה כאן." };
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

  const empty = !debug.allowedKindergartenIds.length ? emptyState("no_relation") : debug.candidateCamerasCount === 0 ? emptyState("no_cameras") : emptyState("not_allowed");

  return (
    <DashboardShell role="parent" title="מצלמות הגן">
      <div className="parent-page-head camera-trust-head">
        <div>
          <p className="eyebrow">צפייה באישור הגן</p>
          <h1>להרגיש קרוב, גם מרחוק.</h1>
          <p>כאן מופיעות רק מצלמות שהגן פתח להורים. כל צפייה מוגבלת בזמן, מתועדת ושומרת על פרטיות הילדים.</p>
        </div>
        <span className={groups.length ? "pill good" : "pill warn"}>{groups.length ? "צפייה זמינה" : "ממתין לאישור הגן"}</span>
      </div>

      <section className="parent-camera-promise">
        <article>
          <ShieldCheck />
          <h2>פרטיות לפני הכול</h2>
          <p>אין גישה למצלמות של גנים אחרים או למצלמות שלא אושרו לצפיית הורים.</p>
        </article>
        <article>
          <Camera />
          <h2>צפייה מאובטחת</h2>
          <p>כל צפייה נפתחת לזמן קצר ומתועדת לצורכי פרטיות ובטיחות.</p>
        </article>
        <article>
          <h2>הגן בשליטה</h2>
          <p>הגן מגדיר שעות צפייה, אזורים והרשאות לפי מדיניות ברורה.</p>
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
              <p>{group.cameras.length} אזורי צפייה שאושרו להורים.</p>
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
