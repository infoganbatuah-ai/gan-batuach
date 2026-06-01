import { Bot, ShieldCheck } from "lucide-react";
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
  const aiConnected = Boolean(process.env.AI_GATEWAY_URL);

  return <DashboardShell role="parent" title="אירועי תצפיתן"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">תצפיתן דיגיטלי</p><h1>אירועי תצפיתן המאושרים להורים.</h1><p>הורה רואה רק אירועים שסומנו במפורש כגלויים להורים ורק בגני הילדים של ילדיו. אירועים פנימיים, רגישים או לא מאושרים אינם מוצגים כאן.</p></div><span className={aiConnected ? "pill good" : "pill warn"}>{aiConnected ? "AI Gateway מחובר" : "ממתין לחיבור מלא"}</span></div><section className="grid cols-2 dashboard-panels"><article className="card action-panel"><Bot /><h2>תצפיתן דיגיטלי ממתין לחיבור מלא</h2><p>{aiConnected ? "ה־AI Gateway מחובר. מוצגים רק אירועים שהגן אישר לצפיית הורים." : "בשלב זה יוצגו רק אירועים היסטוריים/דמו שהוגדרו כגלויים להורים. Live AI מלא דורש AI Gateway."}</p></article><article className="card action-panel"><ShieldCheck /><h2>פרטיות ילדים</h2><p>המערכת אינה חושפת אירועים של גנים אחרים, מצלמות שלא אושרו או אירועים שלא סומנו parent_visible.</p></article></section><section className="dashboard-section">{events.length === 0 ? <div className="empty-state"><strong>אין אירועי תצפיתן זמינים לצפייה כרגע</strong><span>כאשר הגן יאשר אירוע תצפיתן להצגת הורים, הוא יופיע כאן עם זמן, חומרה והסבר קצר.</span></div> : <div className="procedure-list">{events.map((event) => <article className="card procedure-card" key={event.id}><div>{event.screenshot_url ? <img className="snapshot-image" src={event.screenshot_url} alt="תמונת אירוע" /> : <div className="snapshot-placeholder">snapshot</div>}<span className={event.severity === "critical" || event.severity === "high" ? "pill bad" : "pill warn"}>{event.severity}</span><h3>{event.event_type}</h3><p>{event.gardens?.name ?? "גן"} · {event.camera_streams?.name ?? "מצלמה"} · {event.camera_streams?.area ?? "אזור"}</p><small>{event.detected_at ? new Date(event.detected_at).toLocaleString("he-IL") : ""} · confidence {event.confidence ?? "-"}</small></div><div className="procedure-meta"><span className="pill">{event.status ?? "open"}</span><p>{event.notes ?? event.metadata?.parent_summary ?? "אירוע תצפיתן שאושר להצגת הורים."}</p></div></article>)}</div>}</section></DashboardShell>;
}
