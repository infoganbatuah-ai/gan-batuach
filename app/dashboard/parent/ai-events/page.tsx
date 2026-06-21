import { ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export default async function ParentAiEventsPage() {
  const { profile } = await requireRole(["parent"]);
  const userScopedSupabase = await createClient();
  const supabase = isAdminClientConfigured() ? createAdminClient() : userScopedSupabase;
  const family = await getParentFamilyContext(userScopedSupabase as any, profile);
  const gardenIds = family.gardenIds;
  const eventsRes = gardenIds.length
    ? await supabase
        .from("ai_events" as any)
        .select("id, garden_id, camera_stream_id, event_type, severity, status, confidence, detected_at, screenshot_url, notes, metadata, gardens(name), camera_streams(name, area)")
        .in("garden_id", gardenIds)
        .filter("metadata->>parent_visible", "eq", "true")
        .order("detected_at", { ascending: false })
        .limit(40)
    : { data: [] };
  const events = (eventsRes.data ?? []) as any[];

  return (
    <DashboardShell role="parent" title="עדכוני בטיחות" appHome>
      <ParentAppFrame active="more" avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="עדכוני בטיחות" subtitle="רק מה שהגן בדק ואישר להצגת הורים" />
        <section className="parent-camera-promise">
          <article><Sparkles /><h2>סיכום ברור</h2><p>כל עדכון מוצג בשפה קצרה, בלי מונחים טכניים.</p></article>
          <article><ShieldCheck /><h2>פרטיות ילדים</h2><p>הורה רואה רק מידע שאושר לילדים ולגן שלו.</p></article>
        </section>
        <ParentSection title="עדכונים שאושרו" subtitle="אין כאן אירועים פנימיים או מידע שלא אושר.">
          {events.length === 0 ? <ParentEmptyState title="אין עדכוני בטיחות להצגה כרגע" text="אם הגן יאשר עדכון להצגת הורים, הוא יופיע כאן עם זמן והסבר קצר." /> : (
            <div className="parent-request-list">
              {events.map((event) => (
                <article className="parent-document-card" key={event.id}>
                  <div>
                    <span className={event.severity === "critical" || event.severity === "high" ? "parent-status-chip orange" : "parent-status-chip purple"}>{event.severity === "critical" || event.severity === "high" ? "חשוב" : "לעדכון"}</span>
                    <h3>{event.metadata?.parent_title ?? event.event_type}</h3>
                    <p>{event.gardens?.name ?? "גן"} · {event.camera_streams?.area ?? "אזור"}</p>
                    <small>{event.detected_at ? new Date(event.detected_at).toLocaleString("he-IL") : ""}</small>
                  </div>
                  <p>{event.notes ?? event.metadata?.parent_summary ?? "עדכון שאושר להצגת הורים."}</p>
                </article>
              ))}
            </div>
          )}
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
