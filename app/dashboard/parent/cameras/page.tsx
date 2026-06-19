import { Bell, Camera, Car, Eye, Moon, Palette, ShieldCheck, Sparkles, Trees } from "lucide-react";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentListRow, ParentSection } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { getParentCameraListForProfile } from "@/lib/domain/parent-camera-list";
import { createClient } from "@/lib/supabase/server";

type GardenGroup = { id: string; name: string; cameras: any[] };

const reasonText: Record<string, string> = {
  parent_viewing_not_enabled: "הגן לא פתח צפייה להורים",
  camera_inactive_or_disabled: "המצלמה לא זמינה כרגע",
  camera_has_no_parent_playback_source: "המצלמה לא זמינה כרגע",
  parent_camera_garden_mismatch: "נדרשת הרשאה מהגן",
  parent_not_linked_to_kindergarten: "נדרשת הרשאה מהגן"
};

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
  const blocked = result.decisions.filter((decision) => !decision.allowed && decision.diagnostics.camera_found);

  return (
    <DashboardShell role="parent" title="מצלמות הגן" appHome>
      <ParentAppFrame active="dashboard" avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="מצלמות וניטור בזמן אמת" subtitle="צפייה חיה בגן וניטור מצב הילדים" />

        <ParentSection title="מצלמות גן" subtitle={groups.length ? "מצלמות שאושרו לצפיית הורים" : "ממתין לאישור הגן"} className="parent-camera-reference-section">
          {groups.length === 0 ? (
            <ParentEmptyState title={empty.title} text={empty.body} />
          ) : (
            <div className="parent-live-camera-grid">
              {groups.flatMap((group) => group.cameras.slice(0, 3).map((camera) => (
                <article className="parent-live-camera-card" key={camera.id}>
                  <div className="parent-live-thumb">
                    <span>LIVE</span>
                  </div>
                  <h3>{camera.name ?? camera.area ?? "מצלמה"}</h3>
                  <p>HD 1080p</p>
                  <small><ShieldCheck size={18} /> שידור תקין</small>
                  <a href="#secure-playback"><Eye size={18} /> צפייה מהירה</a>
                </article>
              )))}
            </div>
          )}
        </ParentSection>

        <ParentSection title="ניטור חכם — תצפיות AI" subtitle="תצוגה רגועה ומאושרת, בלי התרעות גולמיות להורים">
          <div className="parent-ai-observations">
            <article><span><Bell size={26} /></span><strong>התראה נבדקה</strong><p>11:24 · נבדק על ידי הצוות</p></article>
            <article><span><ShieldCheck size={26} /></span><strong>אזור משחק בטוח</strong><p>הכל תקין · אין חריגות</p></article>
            <article><span><Moon size={26} /></span><strong>שינה תקינה</strong><p>3 ילדים ישנים · סביבה שקטה</p></article>
          </div>
        </ParentSection>

        <ParentSection title="אירועים בזמן אמת">
          <ParentListRow title="פעילות יצירה מהנה!" subtitle="הילדים מכינים עבודות נפלאות" time="11:30" icon={Palette} tone="purple" />
          <ParentListRow title="שינה שקטה" subtitle="הסביבה שקטה" time="11:15" icon={Moon} tone="purple" />
          <ParentListRow title="אזור משחק בטוח" subtitle="לא נמצאו חריגות באזור החצר" time="10:45" icon={Car} tone="green" />
          <ParentListRow title="פעילות חוץ" subtitle="הילדים משחקים בחצר" time="10:05" icon={Trees} tone="green" />
        </ParentSection>

        {groups.length ? (
          <details className="parent-management-section" id="secure-playback">
            <summary>פתיחת נגן מאובטח</summary>
            {groups.map((group) => (
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
          </details>
        ) : null}

        {blocked.length ? (
          <ParentSection title="מצלמות שלא זמינות כרגע" subtitle="הגן שולט בהרשאות ובשעות הצפייה.">
            <div className="parent-request-list">
              {blocked.slice(0, 6).map((decision) => (
                <article className="parent-request-list-card" key={decision.diagnostics.camera_id}>
                  <strong>{decision.diagnostics.camera_name ?? "מצלמה"}</strong>
                  <span>{reasonText[decision.reason] ?? "נדרשת הרשאה מהגן"}</span>
                </article>
              ))}
            </div>
          </ParentSection>
        ) : null}
      </ParentAppFrame>
    </DashboardShell>
  );
}
