import Link from "next/link";
import { Activity, AlertTriangle, Baby, FileText, HeartPulse, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { childTimelinePrivacyRules, childTimelineQuestions, eventDateText, eventTimeText, timelineCategoryLabel, timelineTone } from "@/lib/domain/child-safety-timeline";

function dayKey(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "unknown";
}

export default async function GardenChildTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const { id } = await params;
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("child safety timeline", async () => {
    const supabase = await createClient();
    const [childRes, recordRes, timelineRes, casesRes] = await Promise.all([
      supabase.from("children" as any).select("id,full_name,photo_url,face_image_url,birth_date,classroom,age_group,allergies,medical_notes,regular_medications,status,garden_id").eq("id", id).eq("garden_id", gardenId).maybeSingle(),
      supabase.from("child_unified_records" as any).select("*").eq("child_id", id).maybeSingle(),
      supabase.from("child_timeline_events" as any).select("*, gardens(name)").eq("child_id", id).eq("garden_id", gardenId).order("event_time", { ascending: false }).limit(160),
      supabase.from("incident_cases" as any).select("id,case_number,title,severity,status,created_at").eq("child_id", id).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(20)
    ]);
    [childRes, recordRes, timelineRes, casesRes].forEach((query, index) => logSupabaseError(`child timeline query ${index}`, (query as any).error));
    return {
      child: childRes.data as any,
      record: recordRes.data as any,
      timeline: (timelineRes.data ?? []) as any[],
      cases: (casesRes.data ?? []) as any[],
      queryError: [childRes.error, timelineRes.error].some(Boolean) ? "חלק מנתוני ציר הזמן לא נטענו" : null
    };
  }, { child: null as any, record: null as any, timeline: [] as any[], cases: [] as any[], queryError: null as string | null });

  const data = result.data;
  if (!data.child) {
    return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="ציר ילד"><EmptyState title="לא נמצא ילד" text="ייתכן שהילד לא שייך לגן שלך." action={<Link className="button primary" href="/dashboard/garden/children">חזרה לילדים</Link>} /></DashboardShell>;
  }

  const parentVisible = data.timeline.filter((item) => item.parent_visible && !item.internal_only);
  const incidents = data.timeline.filter((item) => item.event_category === "incidents" || item.safety_relevance === "incident");
  const health = data.timeline.filter((item) => item.event_category === "health");
  const today = data.timeline.filter((item) => dayKey(item.event_time) === new Date().toISOString().slice(0, 10));
  const grouped = data.timeline.reduce((map: Map<string, any[]>, item: any) => {
    const key = dayKey(item.event_time);
    map.set(key, [...(map.get(key) ?? []), item]);
    return map;
  }, new Map<string, any[]>());

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="ציר בטיחות ילד">
      <div className="commercial-dashboard child-timeline-shell">
        <PremiumDashboardHero
          eyebrow="Child Safety Timeline"
          title={`ציר בטיחות של ${data.child.full_name}`}
          subtitle="כל מה שקרה לילד/ה במקום אחד: נוכחות, בריאות, אירועים, מסמכים, הודעות, איסוף ותיקי בדיקה. זהו תיק תפעולי, לא פרופיל אישי."
          badge={`${data.record?.current_safety_score ?? 100}/100`}
          badgeTone={timelineTone(undefined, incidents.length ? "attention" : "routine")}
          actions={<><Link className="button primary" href={`/dashboard/garden/messages?childId=${data.child.id}`}>הודעה להורה</Link><Link className="button secondary" href={`/dashboard/garden/children/${data.child.id}`}>כרטיס ילד</Link></>}
        >
          <div className="child-timeline-hero-card">
            <Avatar name={data.child.full_name} src={data.child.photo_url ?? data.child.face_image_url} />
            <span>{data.child.classroom ?? data.child.age_group ?? "קבוצה לא הוגדרה"}</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="אירועים בציר" value={data.timeline.length} tone={data.timeline.length ? "good" : "warn"} />
          <RoleMetricCard label="היום" value={today.length} hint="עדכונים" tone={today.length ? "good" : "warn"} />
          <RoleMetricCard label="גלוי להורים" value={parentVisible.length} tone="good" />
          <RoleMetricCard label="תיקי בדיקה" value={data.cases.length} tone={data.cases.length ? "warn" : "good"} />
          <RoleMetricCard label="בריאות" value={health.length} tone={health.length ? "warn" : "good"} />
          <RoleMetricCard label="אירועים" value={incidents.length} tone={incidents.length ? "bad" : "good"} />
          <RoleMetricCard label="חוסרים" value={data.record?.missing_update_count ?? 0} tone={data.record?.missing_update_count ? "warn" : "good"} />
          <RoleMetricCard label="עדכון אחרון" value={data.record?.last_event_at ? eventDateText(data.record.last_event_at) : "-"} tone="default" />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Sparkles size={20} /> סיכום בטוח</h2>
            <p>{data.record?.daily_summary ?? "עדיין אין סיכום יומי. הסיכום משתמש רק באירועי ציר הזמן."}</p>
            <div className="child-question-grid">{childTimelineQuestions.map((question) => <Link href={`/dashboard/garden/children/${data.child.id}/timeline`} key={question}>{question}</Link>)}</div>
          </article>
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> כללי פרטיות</h2>
            <div className="setup-checklist">{childTimelinePrivacyRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
          </article>
        </section>

        <CleanSection title="ציר זמן מלא" subtitle="למנהלת מוצגים גם אירועים פנימיים. הורים רואים רק מה שאושר.">
          {data.timeline.length === 0 ? <EmptyState title="אין עדיין אירועים בציר" text="עדכונים מהגן, בריאות, איסוף ומסמכים יופיעו כאן." /> : (
            <div className="child-timeline-days">
              {Array.from(grouped.entries()).map(([date, items]: [string, any[]]) => <section className="child-timeline-day" key={date}>
                <h3>{date === "unknown" ? "ללא תאריך" : new Date(date).toLocaleDateString("he-IL")}</h3>
                <div className="child-timeline-list">{items.map((item: any) => <article className={`child-timeline-item ${timelineTone(item.event_category, item.safety_relevance)}`} key={item.id}>
                  <time>{eventTimeText(item.event_time)}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.description ?? item.summary_safe ?? ""}</span>
                    <small>{timelineCategoryLabel(item.event_category)} · {item.parent_visible ? "גלוי להורים" : "פנימי"}</small>
                  </div>
                  <StatusBadge tone={timelineTone(item.event_category, item.safety_relevance)}>{timelineCategoryLabel(item.event_category)}</StatusBadge>
                </article>)}</div>
              </section>)}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><AlertTriangle size={20} /> תיקי אירוע</h2>
            {data.cases.length === 0 ? <div className="empty-mini">אין תיקי אירוע לילד/ה.</div> : data.cases.map((item) => <div className="list-item" key={item.id}><div><strong>{item.case_number}</strong><span>{item.title}</span></div><StatusBadge tone={timelineTone("incidents", item.severity === "critical" ? "incident" : "attention")}>{item.status}</StatusBadge></div>)}
          </article>
          <article className="card action-panel">
            <h2><HeartPulse size={20} /> בריאות ותפעול</h2>
            <div className="risk-list">
              <div><Activity /> נוכחות <b>{data.record?.attendance_trend?.present_days_30d ?? 0} ימים ב-30 יום</b></div>
              <div><HeartPulse /> תרופות <b>{data.record?.health_trend?.medicine_events ?? 0}</b></div>
              <div><Baby /> אלרגיות <b>{data.child.allergies || "אין"}</b></div>
              <div><FileText /> עדכונים להורים <b>{parentVisible.length}</b></div>
            </div>
          </article>
        </section>
      </div>
    </DashboardShell>
  );
}
