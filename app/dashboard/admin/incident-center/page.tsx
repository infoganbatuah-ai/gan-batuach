import Link from "next/link";
import { AlertTriangle, ClipboardCheck, FileText, Gavel, MessageSquareWarning, ShieldCheck, Sparkles, Timeline } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { caseSafetyRules, caseSeverityTone, caseStatusLabel, caseTypeLabel, evidenceTypeLabel, investigationAssistantPrompts } from "@/lib/domain/incident-cases";

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleString("he-IL") : "לא צוין";
}

export default async function AdminIncidentCenterPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("incident case center", async () => {
    const supabase = await createClient();
    const [casesRes, evidenceRes, timelineRes, actionsRes] = await Promise.all([
      supabase.from("incident_cases" as any).select("*, gardens(name,city)").order("created_at", { ascending: false }).limit(250),
      supabase.from("incident_case_evidence" as any).select("id,case_id,garden_id,evidence_type,title,created_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("incident_case_timeline" as any).select("id,case_id,garden_id,event_type,title,description,created_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("incident_case_corrective_actions" as any).select("id,case_id,garden_id,action_title,severity,status,due_at,created_at").order("created_at", { ascending: false }).limit(250)
    ]);
    [casesRes, evidenceRes, timelineRes, actionsRes].forEach((query, index) => logSupabaseError(`incident center query ${index}`, (query as any).error));
    const cases = (casesRes.data ?? []) as any[];
    const evidence = (evidenceRes.data ?? []) as any[];
    const timeline = (timelineRes.data ?? []) as any[];
    const actions = (actionsRes.data ?? []) as any[];
    return {
      cases,
      evidence,
      timeline,
      actions,
      active: cases.filter((item) => !["resolved", "closed"].includes(String(item.status))),
      highSeverity: cases.filter((item) => ["high", "critical"].includes(String(item.severity))),
      unresolved: cases.filter((item) => !["resolved", "closed"].includes(String(item.status))),
      escalated: cases.filter((item) => ["critical", "pending_decision"].includes(String(item.severity)) || item.status === "pending_decision"),
      closed: cases.filter((item) => ["resolved", "closed"].includes(String(item.status))),
      queryError: [casesRes.error, evidenceRes.error, timelineRes.error, actionsRes.error].some(Boolean) ? "חלק מנתוני תיקי האירוע לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null
    };
  }, { cases: [] as any[], evidence: [] as any[], timeline: [] as any[], actions: [] as any[], active: [] as any[], highSeverity: [] as any[], unresolved: [] as any[], escalated: [] as any[], closed: [] as any[], queryError: null as string | null });

  const data = result.data;
  const evidenceByCase = new Map<string, number>();
  const actionsByCase = new Map<string, number>();
  for (const item of data.evidence) evidenceByCase.set(item.case_id, (evidenceByCase.get(item.case_id) ?? 0) + 1);
  for (const item of data.actions) actionsByCase.set(item.case_id, (actionsByCase.get(item.case_id) ?? 0) + 1);
  const urgentCase = data.highSeverity[0] ?? data.active[0];

  return (
    <DashboardShell role="admin" title="Incident Center">
      <div className="commercial-dashboard incident-center-shell">
        <PremiumDashboardHero
          eyebrow="Incident Investigation"
          title="מרכז תיקי אירוע"
          subtitle="ניהול חקירה, ראיות, ציר זמן ופעולות תיקון. אין מסקנות אוטומטיות ואין שיוך אשמה ללא בדיקה אנושית."
          badge={`${data.active.length} פתוחים`}
          badgeTone={data.highSeverity.length ? "bad" : data.active.length ? "warn" : "good"}
          actions={<><Link className="button primary" href="/dashboard/admin/complaints">דיווחים</Link><Link className="button secondary" href="/dashboard/admin/national-inspections">פיקוח</Link></>}
        >
          <div className="setup-checklist">{caseSafetyRules.slice(0, 3).map((rule) => <span key={rule}>{rule}</span>)}</div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="חקירות פעילות" value={data.active.length} tone={data.active.length ? "warn" : "good"} />
          <RoleMetricCard label="חומרה גבוהה" value={data.highSeverity.length} tone={data.highSeverity.length ? "bad" : "good"} />
          <RoleMetricCard label="לא נסגרו" value={data.unresolved.length} tone={data.unresolved.length ? "warn" : "good"} />
          <RoleMetricCard label="הסלמה" value={data.escalated.length} tone={data.escalated.length ? "bad" : "good"} />
          <RoleMetricCard label="נסגרו" value={data.closed.length} tone="good" />
          <RoleMetricCard label="ראיות" value={data.evidence.length} tone={data.evidence.length ? "good" : "default"} />
          <RoleMetricCard label="ציר זמן" value={data.timeline.length} tone={data.timeline.length ? "good" : "default"} />
          <RoleMetricCard label="פעולות תיקון" value={data.actions.length} tone={data.actions.some((item) => item.status !== "verified" && item.status !== "closed") ? "warn" : "good"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><AlertTriangle size={20} /> תיק דחוף</h2>
            {!urgentCase ? <div className="empty-mini">אין תיק דחוף כרגע.</div> : <div className="incident-featured-case"><StatusBadge tone={caseSeverityTone(urgentCase.severity)}>{urgentCase.severity}</StatusBadge><h3>{urgentCase.title}</h3><p>{urgentCase.summary ?? "ממתין לסיכום"}</p><span>{urgentCase.gardens?.name ?? "גן"} · {caseStatusLabel(urgentCase.status)} · {dateText(urgentCase.created_at)}</span></div>}
          </article>
          <article className="card action-panel">
            <h2><Sparkles size={20} /> עוזר חקירה</h2>
            <p className="muted-text">העוזר מסכם ראיות וציר זמן בלבד. הוא לא קובע אשמה ולא מקבל החלטות.</p>
            <div className="incident-assistant-grid">{investigationAssistantPrompts.map((prompt) => <Link href="/dashboard/admin/incident-center" key={prompt}>{prompt}</Link>)}</div>
          </article>
        </section>

        <CleanSection title="תיקי חקירה" subtitle="כל תיק כולל מקור, סטטוס, ראיות ופעולות תיקון.">
          {data.cases.length === 0 ? <EmptyState title="אין תיקי אירוע" text="כאשר אירוע או תלונה ייפתחו, המיגרציה תיצור תיק בדיקה ראשוני." /> : (
            <div className="incident-case-table">
              {data.cases.slice(0, 14).map((item) => <article className="incident-case-row" key={item.id}>
                <div>
                  <strong>{item.case_number} · {item.title}</strong>
                  <span>{item.gardens?.name ?? "גן"} · {caseTypeLabel(item.incident_type)} · {dateText(item.created_at)}</span>
                </div>
                <StatusBadge tone={caseSeverityTone(item.severity)}>{item.severity}</StatusBadge>
                <StatusBadge tone={caseSeverityTone(item.status)}>{caseStatusLabel(item.status)}</StatusBadge>
                <small>{evidenceByCase.get(item.id) ?? 0} ראיות</small>
                <small>{actionsByCase.get(item.id) ?? 0} פעולות</small>
              </article>)}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><FileText size={20} /> ראיות אחרונות</h2>
            {data.evidence.length === 0 ? <div className="empty-mini">אין ראיות להצגה.</div> : data.evidence.slice(0, 8).map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{evidenceTypeLabel(item.evidence_type)} · {dateText(item.created_at)}</span></div><StatusBadge tone="default">{evidenceTypeLabel(item.evidence_type)}</StatusBadge></div>)}
          </article>
          <article className="card action-panel">
            <h2><Timeline size={20} /> ציר זמן</h2>
            {data.timeline.length === 0 ? <div className="empty-mini">אין אירועי ציר זמן.</div> : data.timeline.slice(0, 8).map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.description ?? item.event_type}</span></div><small>{dateText(item.created_at)}</small></div>)}
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ClipboardCheck size={20} /> פעולות תיקון</h2>
            {data.actions.length === 0 ? <div className="empty-mini">אין פעולות פתוחות.</div> : data.actions.slice(0, 8).map((item) => <div className="list-item" key={item.id}><div><strong>{item.action_title}</strong><span>{item.due_at ? new Date(item.due_at).toLocaleDateString("he-IL") : "ללא יעד"}</span></div><StatusBadge tone={caseSeverityTone(item.severity)}>{item.status}</StatusBadge></div>)}
          </article>
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> כללי פרטיות</h2>
            <div className="setup-checklist">{caseSafetyRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
          </article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="דיווחים ופניות" text="מקורות לתיקים" href="/dashboard/admin/complaints" icon={MessageSquareWarning} />
          <ActionCard title="פיקוח ארצי" text="ביקורת והמשך טיפול" href="/dashboard/admin/national-inspections" icon={Gavel} />
          <ActionCard title="תצפיתן" text="אירועים לבדיקה" href="/dashboard/admin/observer-network" icon={ShieldCheck} />
          <ActionCard title="דוחות" text="סיכום והפקה" href="/dashboard/admin/reports" icon={FileText} />
        </section>
      </div>
    </DashboardShell>
  );
}
