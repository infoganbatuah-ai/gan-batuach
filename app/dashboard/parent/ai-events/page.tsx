import { ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

function isParentApprovedSummary(event: any) {
  const metadata = event?.metadata ?? {};
  return (
    metadata.parent_visible === true &&
    metadata.parent_approved === true &&
    typeof metadata.parent_summary === "string" &&
    metadata.parent_summary.trim().length > 0 &&
    ["confirmed", "reviewed", "parent_approved", "done"].includes(String(event?.status ?? ""))
  );
}

export default async function ParentAiEventsPage() {
  const { profile } = await requireRole(["parent"]);
  const userScopedSupabase = await createClient();
  const family = await getParentFamilyContext(userScopedSupabase as any, profile);
  const gardenIds = family.gardenIds;
  const eventsRes = gardenIds.length
    ? await userScopedSupabase
        .from("ai_events" as any)
        .select("id, garden_id, severity, status, detected_at, metadata, gardens(name)")
        .in("garden_id", gardenIds)
        .filter("metadata->>parent_visible", "eq", "true")
        .order("detected_at", { ascending: false })
        .limit(40)
    : { data: [] };
  const events = ((eventsRes.data ?? []) as any[]).filter(isParentApprovedSummary);

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
                    <h3>{event.metadata?.parent_title ?? "עדכון בטיחות שאושר"}</h3>
                    <p>{event.gardens?.name ?? "גן"}</p>
                    <small>{event.detected_at ? new Date(event.detected_at).toLocaleString("he-IL") : ""}</small>
                  </div>
                  <p>{event.metadata?.parent_summary ?? "עדכון שאושר להצגת הורים."}</p>
                </article>
              ))}
            </div>
          )}
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
