import Link from "next/link";
import { Camera, CheckCircle2, ClipboardList, MessageSquareText, Radar, ShieldCheck, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildPilotHealthSummary, pilotRoleJourneys, pilotTone } from "@/lib/domain/pilot-health";

function journeyLabel(step: string) {
  const labels: Record<string, string> = {
    login: "כניסה",
    onboarding: "קליטה",
    children_management: "ניהול ילדים",
    parent_management: "ניהול הורים",
    staff_management: "ניהול צוות",
    documents: "מסמכים",
    cameras: "מצלמות",
    observer: "תצפיתן",
    registration: "רישום",
    child_access: "גישה לילד",
    attendance_visibility: "נוכחות",
    messages: "הודעות",
    pickup: "איסוף",
    cameras_if_enabled: "מצלמות",
    invitation: "הזמנה",
    permissions: "הרשאות",
    attendance: "נוכחות",
    tasks: "משימות",
    communication: "תקשורת"
  };
  return labels[step] ?? step;
}

export default async function AdminPilotHealthPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("pilot health", async () => {
    const supabase = await createClient();
    const [pilotsRes, checklistRes, journeysRes, issuesRes, feedbackRes, usageRes, criteriaRes, participantsRes, camerasRes, observerReviewsRes] = await Promise.all([
      supabase.from("pilot_programs" as any).select("*, gardens(name, city)").eq("real_customer_pilot", true).order("created_at", { ascending: false }).limit(5),
      supabase.from("pilot_deployment_checklist" as any).select("*").order("category").limit(200),
      supabase.from("pilot_journey_validations" as any).select("*").order("role_key").order("journey_step").limit(300),
      supabase.from("pilot_issues" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(200),
      supabase.from("pilot_feedback" as any).select("id,user_role,garden_id,category,status,severity,sentiment,rating,comment,page_path,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("pilot_usage_analytics" as any).select("*").order("usage_date", { ascending: false }).limit(200),
      supabase.from("pilot_success_criteria" as any).select("*").order("criteria_key").limit(100),
      supabase.from("pilot_participants" as any).select("*, profiles(full_name, role)").order("created_at", { ascending: false }).limit(300),
      supabase.from("camera_streams" as any).select("id,garden_id,name,status,stream_status,health_status,test_site_type,deployment_scope,last_test_status").limit(200),
      supabase.from("observer_ground_truth_reviews" as any).select("id,outcome,created_at").order("created_at", { ascending: false }).limit(100)
    ]);
    [pilotsRes, checklistRes, journeysRes, issuesRes, feedbackRes, usageRes, criteriaRes, participantsRes, camerasRes, observerReviewsRes].forEach((query, index) => logSupabaseError(`pilot health query ${index}`, (query as any).error));
    const pilots = (pilotsRes.data ?? []) as any[];
    const checklist = (checklistRes.data ?? []) as any[];
    const journeys = (journeysRes.data ?? []) as any[];
    const issues = (issuesRes.data ?? []) as any[];
    const feedback = (feedbackRes.data ?? []) as any[];
    const usage = (usageRes.data ?? []) as any[];
    const successCriteria = (criteriaRes.data ?? []) as any[];
    const participants = (participantsRes.data ?? []) as any[];
    const cameras = (camerasRes.data ?? []) as any[];
    const observerReviews = (observerReviewsRes.data ?? []) as any[];
    return {
      pilots,
      checklist,
      journeys,
      issues,
      feedback,
      usage,
      successCriteria,
      participants,
      cameras,
      observerReviews,
      summary: buildPilotHealthSummary({ pilots, checklist, journeys, issues, feedback, usage, successCriteria, participants, cameras, observerReviews }),
      queryError: [pilotsRes.error, checklistRes.error, journeysRes.error, issuesRes.error, feedbackRes.error, usageRes.error, criteriaRes.error, participantsRes.error, camerasRes.error, observerReviewsRes.error].some(Boolean) ? "חלק מנתוני בריאות הפיילוט לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null
    };
  }, {
    pilots: [] as any[],
    checklist: [] as any[],
    journeys: [] as any[],
    issues: [] as any[],
    feedback: [] as any[],
    usage: [] as any[],
    successCriteria: [] as any[],
    participants: [] as any[],
    cameras: [] as any[],
    observerReviews: [] as any[],
    summary: buildPilotHealthSummary(),
    queryError: null as string | null
  });
  const { summary } = result.data;
  const pilot = result.data.pilots[0];
  const openIssues = result.data.issues.filter((issue: any) => !["verified", "accepted_risk"].includes(String(issue.status))).slice(0, 8);
  const latestFeedback = result.data.feedback.slice(0, 8);

  return (
    <DashboardShell role="admin" title="Pilot Health">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="First Kindergarten Pilot"
          title="בריאות פיילוט ראשון"
          subtitle="מעקב יומי אחרי הגן הראשון: משתמשים, מסעות, מצלמות, תצפיתן, משוב, בעיות וקריטריוני הצלחה."
          badge={`${summary.readinessScore}/100`}
          badgeTone={pilotTone(summary.readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/pilot-center">מרכז פיילוט</Link><Link className="button secondary" href="/dashboard/admin/launch-readiness">מוכנות השקה</Link></>}
        >
          <div className="setup-checklist">
            <span>סטטוס: {summary.pilotStatus}</span>
            <span>סביבה אמיתית: כן</span>
            <span>שינויים: למידה ותיקוף בלבד</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? result.data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="סטטוס פיילוט" value={summary.pilotStatus} hint={pilot?.kindergarten_name ?? pilot?.gardens?.name ?? "גן פיילוט"} tone={pilotTone(summary.pilotStatus)} />
          <RoleMetricCard label="משתמשים פעילים" value={summary.activeUsers} hint="משתתפים או DAU" tone={summary.activeUsers ? "good" : "warn"} />
          <RoleMetricCard label="בעיות פתוחות" value={summary.openIssues} hint={`${summary.criticalIssues} קריטי · ${summary.highIssues} גבוה`} tone={summary.criticalIssues || summary.highIssues ? "bad" : summary.openIssues ? "warn" : "good"} />
          <RoleMetricCard label="משובים" value={summary.feedbackCount} hint={`${summary.openFeedback} פתוחים`} tone={summary.openFeedback ? "warn" : "good"} />
          <RoleMetricCard label="Checklist" value={`${summary.checklistScore}%`} hint="פריסה והפעלה" tone={pilotTone(summary.checklistScore)} />
          <RoleMetricCard label="Journeys" value={`${summary.journeyScore}%`} hint="מנהל, הורה, צוות" tone={pilotTone(summary.journeyScore)} />
          <RoleMetricCard label="Camera" value={`${summary.cameraScore}%`} hint="חיבור או test mode" tone={pilotTone(summary.cameraScore)} />
          <RoleMetricCard label="Observer" value={`${summary.observerScore}%`} hint="Shadow + review" tone={pilotTone(summary.observerScore)} />
        </section>

        <CleanSection title="פרופיל הגן" subtitle="פרטי פיילוט ראשונים, לפני הרחבה לגנים נוספים.">
          {!pilot ? <EmptyState title="אין פרופיל פיילוט" text="הרצת המיגרציה תיצור פרופיל פיילוט ראשון." /> : (
            <section className="grid cols-3 dashboard-panels">
              <article className="card action-panel"><Users /><h2>{pilot.kindergarten_name ?? pilot.pilot_name}</h2><p>מנהלת: {pilot.manager_name ?? "טרם עודכן"} · איש קשר: {pilot.contact_person_name ?? "טרם עודכן"}</p></article>
              <article className="card action-panel"><ClipboardList /><h2>היקף</h2><p>{pilot.number_of_children ?? 0} ילדים · {pilot.number_of_staff ?? 0} אנשי צוות · {pilot.number_of_classrooms ?? 0} כיתות</p></article>
              <article className="card action-panel"><Camera /><h2>מצלמות ותצפיתן</h2><p>מצלמות: {pilot.camera_availability} · תצפיתן: {pilot.observer_participation ? "משתתף" : "לא משתתף"}</p></article>
            </section>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><CheckCircle2 size={20} /> Deployment checklist</h2>
            {result.data.checklist.length === 0 ? <div className="empty-mini">אין checklist.</div> : result.data.checklist.map((item: any) => (
              <div className="list-item" key={item.id}>
                <div><strong>{item.title}</strong><span>{item.category} · {item.evidence_summary ?? "ממתין לאימות"}</span></div>
                <StatusBadge tone={pilotTone(item.status)}>{item.status}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Radar size={20} /> Success criteria</h2>
            <div className="risk-list">
              <div>Manager satisfaction <b>{summary.managerSatisfaction}%</b></div>
              <div>Parent satisfaction <b>{summary.parentSatisfaction}%</b></div>
              <div>Onboarding completion <b>{summary.onboardingCompletion}%</b></div>
              <div>Issue resolution <b>{summary.issueResolution}%</b></div>
              <div>Observer readiness <b>{summary.observerReadiness}%</b></div>
              <div>Camera readiness <b>{summary.cameraReadiness}%</b></div>
            </div>
          </article>
        </section>

        <CleanSection title="מסעות משתמשים" subtitle="תיקוף אמיתי של מנהלת, הורים וצוות.">
          <section className="grid cols-3 dashboard-panels">
            {Object.entries(pilotRoleJourneys).map(([role, steps]) => (
              <article className="card action-panel" key={role}>
                <h2>{role}</h2>
                <div className="setup-checklist">
                  {steps.map((step) => {
                    const row = result.data.journeys.find((journey: any) => journey.role_key === role && journey.journey_step === step);
                    return <span key={step}>{journeyLabel(step)} · {row?.status ?? "not_tested"}</span>;
                  })}
                </div>
              </article>
            ))}
          </section>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><MessageSquareText size={20} /> משובים אחרונים</h2>
            {latestFeedback.length === 0 ? <div className="empty-mini">אין משובים עדיין.</div> : latestFeedback.map((item: any) => (
              <div className="list-item" key={item.id}>
                <div><strong>{item.user_role} · {item.category}</strong><span>{item.comment || item.sentiment || "משוב קצר"}</span></div>
                <StatusBadge tone={pilotTone(item.status)}>{item.status}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> בעיות פתוחות</h2>
            {openIssues.length === 0 ? <div className="empty-mini">אין בעיות פתוחות.</div> : openIssues.map((issue: any) => (
              <div className="list-item" key={issue.id}>
                <div><strong>{issue.title}</strong><span>{issue.affected_role} · {issue.description ?? "ללא פירוט"}</span></div>
                <StatusBadge tone={pilotTone(issue.severity)}>{issue.severity}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="מרכז פיילוט" text="פרופילים, משתתפים ומשובים" href="/dashboard/admin/pilot-center" icon={Users} />
          <ActionCard title="מצלמות" text="חיבור, test mode ובריאות" href="/dashboard/admin/camera-deployment" icon={Camera} />
          <ActionCard title="תצפיתן" text="Replay, כיול ו-review" href="/dashboard/admin/observer-calibration" icon={Radar} />
          <ActionCard title="אבטחה" text="חסמים לפני הרחבה" href="/dashboard/admin/security-center" icon={ShieldCheck} />
        </section>
      </div>
    </DashboardShell>
  );
}
