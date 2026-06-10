import { ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
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

  return <DashboardShell role="parent" title="עדכוני בטיחות"><div className="parent-page-head"><div><p className="eyebrow">עדכונים שאושרו להורים</p><h1>רק מה שהגן בדק ואישר.</h1><p>כאן מופיעים עדכוני בטיחות שהצוות אישר להצגת הורים. אין כאן אירועים פנימיים או מידע שלא אושר.</p></div><span className="pill good">בדיקה אנושית חובה</span></div><section className="parent-camera-promise"><article><Sparkles /><h2>סיכום ברור</h2><p>כל עדכון מוצג בשפה קצרה, בלי מונחים טכניים.</p></article><article><ShieldCheck /><h2>פרטיות ילדים</h2><p>הורה רואה רק מידע שאושר לילדים ולגן שלו.</p></article></section><section className="dashboard-section">{events.length === 0 ? <div className="empty-state"><strong>אין עדכוני בטיחות להצגה כרגע</strong><span>אם הגן יאשר עדכון להצגת הורים, הוא יופיע כאן עם זמן והסבר קצר.</span></div> : <div className="procedure-list">{events.map((event) => <article className="card procedure-card" key={event.id}><div>{event.screenshot_url ? <img className="snapshot-image" src={event.screenshot_url} alt="תמונת עדכון" /> : <div className="snapshot-placeholder">עדכון</div>}<span className={event.severity === "critical" || event.severity === "high" ? "pill bad" : "pill warn"}>{event.severity === "critical" || event.severity === "high" ? "חשוב" : "לעדכון"}</span><h3>{event.metadata?.parent_title ?? event.event_type}</h3><p>{event.gardens?.name ?? "גן"} · {event.camera_streams?.area ?? "אזור"}</p><small>{event.detected_at ? new Date(event.detected_at).toLocaleString("he-IL") : ""}</small></div><div className="procedure-meta"><span className="pill good">אושר להצגה</span><p>{event.notes ?? event.metadata?.parent_summary ?? "עדכון שאושר להצגת הורים."}</p></div></article>)}</div>}</section></DashboardShell>;
}
