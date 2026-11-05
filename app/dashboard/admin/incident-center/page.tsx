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
    async function safeQuery<T>(index: number, run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
      try {
        const query = await run();
        logSupabaseError(`incident center query ${index}`, query.error);
        return { data: query.error ? [] as T[] : query.data ?? [], available: !query.error };
      } catch (error) {
        logSupabaseError(`incident center query ${index}`, error);
        return { data: [] as T[], available: false };
      }
    }
    const [casesRes, evidenceRes, timelineRes, actionsRes] = await Promise.all([
      safeQuery(0, () => supabase.from("incident_cases" as any).select("*, gardens(name,city)").order("created_at", { ascending: false }).limit(250)),
      safeQuery(1, () => supabase.from("incident_case_evidence" as any).select("id,case_id,garden_id,evidence_type,title,created_at").order("created_at", { ascending: false }).limit(300)),
      safeQuery(2, () => supabase.from("incident_case_timeline" as any).select("id,case_id,garden_id,event_type,title,description,created_at").order("created_at", { ascending: false }).limit(300)),
      safeQuery(3, () => supabase.from("incident_case_corrective_actions" as any).select("id,case_id,garden_id,action_title,severity,status,due_at,created_at").order("created_at", { ascending: false }).limit(250))
    ]);
    const available = [casesRes, evidenceRes, timelineRes, actionsRes].map((query) => query.available);
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
      available,
      queryError: available.some((value) => !value) ? "חלק מנתוני תיקי האירוע אינם זמינים. אין להסיק מכך שאין תיקים, ראיות או פעולות ממתינות." : null
    };
  }, { cases: [] as any[], evidence: [] as any[], timeline: [] as any[], actions: [] as any[], active: [] as any[], highSeverity: [] as any[], unresolved: [] as any[], escalated: [] as any[], closed: [] as any[], available: Array<boolean>(4).fill(false), queryError: null as string | null });

  const data = result.data;
  const known = (index: number) => data.available[index];
  const unavailable = "לא זמין";
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
          badge={known(0) ? `${data.active.length} פתוחים` : unavailable}
          badgeTone={known(0) ? data.highSeverity.length ? "bad" : data.active.length ? "warn" : "good" : "default"}
          actions={<><Link className="button primary" href="/dashboard/admin/complaints">דיווחים</Link><Link className="button secondary" href="/dashboard/admin/national-inspections">פיקוח</Link></>}
        >
          <div className="setup-checklist">{caseSafetyRules.slice(0, 3).map((rule) => <span key={rule}>{rule}</span>)}</div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />
        <p className="muted-text">תצוגת מטא־נתונים בלבד; אינה הוכחה להשלמת חקירה, להגנת נכסי ראיות, לאכיפת הרשאות או להפעלת עוזר AI. כללי הבטיחות והפרטיות הם דרישות לביצוע.</p>

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="חקירות פעילות" value={known(0) ? data.active.length : unavailable} tone={known(0) ? data.active.length ? "warn" : "good" : "default"} />
          <RoleMetricCard label="חומרה גבוהה" value={known(0) ? data.highSeverity.length : unavailable} tone={known(0) ? data.highSeverity.length ? "bad" : "good" : "default"} />
          <RoleMetricCard label="לא נסגרו" value={known(0) ? data.unresolved.length : unavailable} tone={known(0) ? data.unresolved.length ? "warn" : "good" : "default"} />
          <RoleMetricCard label="הסלמה" value={known(0) ? data.escalated.length : unavailable} tone={known(0) ? data.escalated.length ? "bad" : "good" : "default"} />
          <RoleMetricCard label="נסגרו" value={known(0) ? data.closed.length : unavailable} tone={known(0) ? "good" : "default"} />
          <RoleMetricCard label="ראיות" value={known(1) ? data.evidence.length : unavailable} tone={known(1) ? data.evidence.length ? "good" : "default" : "default"} />
          <RoleMetricCard label="ציר זמן" value={known(2) ? data.timeline.length : unavailable} tone={known(2) ? data.timeline.length ? "good" : "default" : "default"} />
          <RoleMetricCard label="פעולות תיקון" value={known(3) ? data.actions.length : unavailable} tone={known(3) ? data.actions.some((item) => item.status !== "verified" && item.status !== "closed") ? "warn" : "good" : "default"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><AlertTriangle size={20} /> תיק דחוף</h2>
            {!known(0) ? <div className="empty-mini">{unavailable}</div> : !urgentCase ? <div className="empty-mini">אין תיק דחוף כרגע.</div> : <div className="incident-featured-case"><StatusBadge tone={caseSeverityTone(urgentCase.severity)}>{urgentCase.severity}</StatusBadge><h3>{urgentCase.title}</h3><p>{urgentCase.summary ?? "ממתין לסיכום"}</p><span>{urgentCase.gardens?.name ?? "גן"} · {caseStatusLabel(urgentCase.status)} · {dateText(urgentCase.created_at)}</span></div>}
          </article>
          <article className="card action-panel">
            <h2><Sparkles size={20} /> עוזר חקירה</h2>
            <p className="muted-text">ייעוד העוזר: סיכום ראיות וציר זמן בלבד. הוא לא קובע אשמה ולא מקבל החלטות.</p>
            <div className="incident-assistant-grid">{investigationAssistantPrompts.map((prompt) => <Link href="/dashboard/admin/incident-center" key={prompt}>{prompt}</Link>)}</div>
          </article>
        </section>

        <CleanSection title="תיקי חקירה" subtitle="כל תיק כולל מקור, סטטוס, ראיות ופעולות תיקון.">
          {!known(0) ? <div className="empty-mini">{unavailable}</div> : data.cases.length === 0 ? <EmptyState title="אין תיקי אירוע" text="כאשר אירוע או תלונה ייפתחו, המיגרציה תיצור תיק בדיקה ראשוני." /> : (
            <div className="incident-case-table">
              {data.cases.slice(0, 14).map((item) => <article className="incident-case-row" key={item.id}>
                <div>
                  <strong>{item.case_number} · {item.title}</strong>
                  <span>{item.gardens?.name ?? "גן"} · {caseTypeLabel(item.incident_type)} · {dateText(item.created_at)}</span>
                </div>
                <StatusBadge tone={caseSeverityTone(item.severity)}>{item.severity}</StatusBadge>
                <StatusBadge tone={caseSeverityTone(item.status)}>{caseStatusLabel(item.status)}</StatusBadge>
                <small>{known(1) ? evidenceByCase.get(item.id) ?? 0 : unavailable} ראיות</small>
                <small>{known(3) ? actionsByCase.get(item.id) ?? 0 : unavailable} פעולות</small>
              </article>)}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><FileText size={20} /> ראיות אחרונות</h2>
            {!known(1) ? <div className="empty-mini">{unavailable}</div> : data.evidence.length === 0 ? <div className="empty-mini">אין ראיות להצגה.</div> : data.evidence.slice(0, 8).map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{evidenceTypeLabel(item.evidence_type)} · {dateText(item.created_at)}</span></div><StatusBadge tone="default">{evidenceTypeLabel(item.evidence_type)}</StatusBadge></div>)}
          </article>
          <article className="card action-panel">
            <h2><Timeline size={20} /> ציר זמן</h2>
            {!known(2) ? <div className="empty-mini">{unavailable}</div> : data.timeline.length === 0 ? <div className="empty-mini">אין אירועי ציר זמן.</div> : data.timeline.slice(0, 8).map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.description ?? item.event_type}</span></div><small>{dateText(item.created_at)}</small></div>)}
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ClipboardCheck size={20} /> פעולות תיקון</h2>
            {!known(3) ? <div className="empty-mini">{unavailable}</div> : data.actions.length === 0 ? <div className="empty-mini">אין פעולות פתוחות.</div> : data.actions.slice(0, 8).map((item) => <div className="list-item" key={item.id}><div><strong>{item.action_title}</strong><span>{item.due_at ? new Date(item.due_at).toLocaleDateString("he-IL") : "ללא יעד"}</span></div><StatusBadge tone={caseSeverityTone(item.severity)}>{item.status}</StatusBadge></div>)}
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
