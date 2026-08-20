import { Activity, Bell, BrainCircuit, Camera, CreditCard, Gauge, ServerCog, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireRole } from "@/lib/auth";
import { getDigitalObserverServiceReadiness } from "@/lib/domain/digital-observer/service-readiness";
import { observerStatusLabel } from "@/lib/domain/digital-observer/runtime";
import { createClient } from "@/lib/supabase/server";

async function countRows(supabase: any, table: string, configure?: (query: any) => any) {
  try { let query = supabase.from(table).select("id", { count: "exact", head: true }); if (configure) query = configure(query); const result = await query; return result.error ? null : result.count ?? 0; } catch { return null; }
}

export default async function DigitalObserverAdminOperationsPage() {
  const { profile } = await requireRole(["admin"], "/digital-observer/login?next=/digital-observer/admin/operations", "/digital-observer/dashboard");
  const supabase = await createClient();
  const readiness = getDigitalObserverServiceReadiness();
  const [cameras, signals, deliveries, clips] = await Promise.all([
    countRows(supabase, "digital_observer_camera_sources"),
    countRows(supabase, "observer_intelligence_signals", (query) => query.in("review_status", ["needs_review", "reviewing", "escalated"])),
    countRows(supabase, "digital_observer_notification_deliveries"),
    countRows(supabase, "digital_observer_event_clips")
  ]);
  const services = [
    { id: "gateway", icon: Camera, label: "Gateway מצלמות", state: readiness.cameraGateway.state, detail: "RTSP, ONVIF, NVR/DVR ו-Edge עוברים דרך מחבר שרת." },
    { id: "ai", icon: BrainCircuit, label: "מנוע AI", state: readiness.ai.state, detail: "Shadow וביקורת אנושית לפני הצגה או הסלמה." },
    { id: "notifications", icon: Bell, label: "התראות", state: readiness.notifications.inApp, detail: "In-app זמין; ספקים חיצוניים נשארים כבויים ללא Sandbox." },
    { id: "billing", icon: CreditCard, label: "חיוב", state: readiness.billing.state, detail: "Mock בלבד; אין גבייה, חשבונית או receipt חי." },
    { id: "integration", icon: ShieldCheck, label: "API לגן בטוח", state: readiness.ganBatuachIntegration.state, detail: "כבוי כברירת מחדל, tenant scope ו-audit נדרשים לכל קריאה." }
  ];

  return <ObserverAppShell profile={profile} mode="business" activeHref="/digital-observer/admin/operations" title="תפעול ובריאות מערכת" statusLabel="אין סודות בדפדפן">
    <div className="do-page-stack">
      <section className="do-business-summary"><article className="do-metric"><Camera /><strong>{cameras ?? "—"}</strong><span>מקורות מצלמה</span></article><article className="do-metric alert"><Activity /><strong>{signals ?? "—"}</strong><span>אירועים לבדיקה</span></article><article className="do-metric"><Bell /><strong>{deliveries ?? "—"}</strong><span>מסירות מתועדות</span></article><article className="do-metric"><ServerCog /><strong>{clips ?? "—"}</strong><span>מקטעי אירוע</span></article></section>
      <section className="do-grid cols-2">{services.map(({ id, icon: Icon, label, state, detail }) => <article className="do-panel" id={id} key={id}><div className="do-section-head"><div><h2>{label}</h2><p>{detail}</p></div><span className={state === "sandbox" || state === "readiness" ? "do-badge good" : "do-badge warn"}>{observerStatusLabel(state)}</span></div><Icon /><div className="do-notice info"><span>ערכי הגדרה נבדקים לפי נוכחות בלבד. מפתחות, tokens ופרטי מצלמה אינם מוצגים במסך.</span></div></article>)}</section>
      <section className="do-panel" id="readiness"><div className="do-section-head"><div><h2>שער יציאה לייצור</h2><p>כל שירות חיצוני מתקדם בנפרד דרך Sandbox, ראיות QA ואישור Go/No-Go.</p></div><Gauge /></div><div className="do-summary-list"><div><span>מצלמה אמיתית</span><strong>נדרש Gateway וחומרת בדיקה</strong></div><div><span>AI Shadow</span><strong>נדרש ספק ומדגם סינתטי</strong></div><div><span>תשלום וחשבונית</span><strong>נדרש ספק Sandbox</strong></div><div><span>Push / Email / SMS / WhatsApp</span><strong>נדרש ספק Sandbox לכל ערוץ</strong></div><div><span>Native</span><strong>נדרשים sync ובדיקת מכשיר</strong></div></div></section>
    </div>
  </ObserverAppShell>;
}
