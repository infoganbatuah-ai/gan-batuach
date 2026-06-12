import Link from "next/link";
import { AlertTriangle, BookOpenCheck, GraduationCap, HeartHandshake, LifeBuoy, LineChart, MessageCircle, PlayCircle, RefreshCcw, Search, Sparkles, TicketCheck, UsersRound } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row?.[key] ?? 0)).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function pct(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

function tone(value: number | string) {
  if (typeof value === "number") {
    if (value >= 82) return "good" as const;
    if (value >= 62) return "warn" as const;
    return "bad" as const;
  }
  const normalized = value.toLowerCase();
  if (["active", "resolved", "closed", "completed", "published", "low"].includes(normalized)) return "good" as const;
  if (["onboarding", "assigned", "in_progress", "waiting_customer", "renewal_pending", "medium", "sent", "scheduled"].includes(normalized)) return "warn" as const;
  return "bad" as const;
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    lead: "ליד",
    demo_booked: "הדגמה נקבעה",
    approved: "אושר",
    onboarding: "קליטה",
    active: "פעיל",
    at_risk: "בסיכון",
    renewal_pending: "חידוש קרוב",
    suspended: "מושהה",
    churned: "נטש",
    open: "פתוח",
    assigned: "שויך",
    in_progress: "בטיפול",
    waiting_customer: "ממתין ללקוח",
    resolved: "טופל",
    closed: "נסגר"
  };
  return labels[status ?? "open"] ?? status ?? "פתוח";
}

function date(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function lifecycleFromGarden(garden: any) {
  const status = String(garden.approval_flow_status ?? garden.final_approval_status ?? garden.status ?? "");
  if (["active", "approved", "safe"].includes(status)) return "active";
  if (["payment_pending"].includes(status)) return "renewal_pending";
  if (["suspended", "frozen"].includes(status)) return "suspended";
  if (["admin_approved", "activation_in_progress", "onboarding_in_progress", "pending_final_approval"].includes(status)) return "onboarding";
  return status || "lead";
}

export default async function CustomerSuccessPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("customer success", async () => {
    const supabase = await createClient();
    const [
      gardensRes,
      profilesRes,
      staffRes,
      parentsRes,
      documentsRes,
      subscriptionsRes,
      healthRes,
      lifecycleRes,
      ticketsRes,
      trainingRes,
      completionsRes,
      knowledgeRes,
      tasksRes,
      risksRes,
      playbooksRes,
      surveysRes,
      adoptionRes,
      reportsRes,
      readinessRes
    ] = await Promise.all([
      supabase.from("gardens" as any).select("id,name,city,status,safe_status,approval_flow_status,final_approval_status,created_at,current_children_count,staff_count").order("created_at", { ascending: false }).limit(1000),
      supabase.from("profiles" as any).select("id,role,garden_id,active,last_login_at,created_at").limit(6000),
      supabase.from("staff" as any).select("id,garden_id,onboarding_status,approved_to_work,created_at").limit(3000),
      supabase.from("parents" as any).select("id,garden_id,status,completed_profile,onboarding_status,created_at").limit(5000),
      supabase.from("documents" as any).select("id,garden_id,status,created_at").limit(5000),
      supabase.from("kindergarten_subscriptions" as any).select("id,garden_id,billing_status,renewal_date,trial_status").limit(1500),
      supabase.from("customer_health_scores" as any).select("*, gardens(name,city)").order("calculated_at", { ascending: false }).limit(1000),
      supabase.from("customer_lifecycle_events" as any).select("*, gardens(name,city)").order("occurred_at", { ascending: false }).limit(150),
      supabase.from("support_tickets" as any).select("*, gardens(name,city), profiles:requester_profile_id(full_name)").order("created_at", { ascending: false }).limit(150),
      supabase.from("training_hub_items" as any).select("*").order("display_order", { ascending: true }).limit(120),
      supabase.from("training_completion_records" as any).select("*, training_hub_items(title,audience_role), gardens(name)").order("created_at", { ascending: false }).limit(300),
      supabase.from("knowledge_base_articles" as any).select("*").order("updated_at", { ascending: false }).limit(120),
      supabase.from("customer_success_tasks" as any).select("*, gardens(name,city)").order("created_at", { ascending: false }).limit(150),
      supabase.from("renewal_risk_signals" as any).select("*, gardens(name,city)").order("risk_score", { ascending: false }).limit(150),
      supabase.from("success_playbooks" as any).select("*").eq("active", true).order("created_at", { ascending: false }).limit(80),
      supabase.from("customer_success_surveys" as any).select("*, gardens(name,city)").order("created_at", { ascending: false }).limit(120),
      supabase.from("product_adoption_analytics" as any).select("*, gardens(name,city)").order("period_end", { ascending: false }).limit(250),
      supabase.from("customer_success_reports" as any).select("*").order("period_end", { ascending: false }).limit(80),
      supabase.from("customer_success_readiness" as any).select("*").order("material_type").limit(80)
    ]);

    [
      gardensRes,
      profilesRes,
      staffRes,
      parentsRes,
      documentsRes,
      subscriptionsRes,
      healthRes,
      lifecycleRes,
      ticketsRes,
      trainingRes,
      completionsRes,
      knowledgeRes,
      tasksRes,
      risksRes,
      playbooksRes,
      surveysRes,
      adoptionRes,
      reportsRes,
      readinessRes
    ].forEach((query, index) => logSupabaseError(`customer success query ${index}`, (query as any).error));

    const gardens = (gardensRes.data ?? []) as any[];
    const profiles = (profilesRes.data ?? []) as any[];
    const staff = (staffRes.data ?? []) as any[];
    const parents = (parentsRes.data ?? []) as any[];
    const documents = (documentsRes.data ?? []) as any[];
    const subscriptions = (subscriptionsRes.data ?? []) as any[];
    const health = (healthRes.data ?? []) as any[];
    const lifecycle = (lifecycleRes.data ?? []) as any[];
    const tickets = (ticketsRes.data ?? []) as any[];
    const training = (trainingRes.data ?? []) as any[];
    const completions = (completionsRes.data ?? []) as any[];
    const knowledge = (knowledgeRes.data ?? []) as any[];
    const tasks = (tasksRes.data ?? []) as any[];
    const risks = (risksRes.data ?? []) as any[];
    const playbooks = (playbooksRes.data ?? []) as any[];
    const surveys = (surveysRes.data ?? []) as any[];
    const adoption = (adoptionRes.data ?? []) as any[];
    const reports = (reportsRes.data ?? []) as any[];
    const readiness = (readinessRes.data ?? []) as any[];

    const activeGardens = gardens.filter((garden) => ["active", "approved", "safe"].includes(lifecycleFromGarden(garden)) || garden.safe_status === "safe").length;
    const onboardingGardens = gardens.filter((garden) => lifecycleFromGarden(garden) === "onboarding").length;
    const openTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(String(ticket.status))).length;
    const urgentTickets = tickets.filter((ticket) => ["urgent", "critical"].includes(String(ticket.priority)) && !["resolved", "closed"].includes(String(ticket.status))).length;
    const atRisk = health.filter((row) => ["high", "critical"].includes(String(row.renewal_risk_level)) || Number(row.customer_health_score ?? 0) < 60).length + risks.filter((row) => ["high", "critical"].includes(String(row.severity))).length;
    const managerOnboarding = pct(profiles.filter((profile) => ["manager", "owner"].includes(String(profile.role)) && profile.active !== false).length, Math.max(gardens.length, 1));
    const staffOnboarding = pct(staff.filter((item) => item.approved_to_work || item.onboarding_status === "active").length, staff.length);
    const parentOnboarding = pct(parents.filter((item) => item.completed_profile || item.onboarding_status === "active" || item.status === "active").length, parents.length);
    const documentCompletion = pct(documents.filter((doc) => ["approved", "signed"].includes(String(doc.status))).length, documents.length);
    const paymentCompletion = pct(subscriptions.filter((sub) => ["active", "paid"].includes(String(sub.billing_status))).length, subscriptions.length);
    const trainingCompletion = pct(completions.filter((item) => item.completion_status === "completed").length, completions.length);
    const averageHealth = avg(health, "customer_health_score") || Math.round((managerOnboarding + staffOnboarding + parentOnboarding + documentCompletion + paymentCompletion) / 5);
    const queryError = [healthRes.error, ticketsRes.error, trainingRes.error, knowledgeRes.error].some(Boolean)
      ? "חלק מנתוני Customer Success לא נטענו. ייתכן שמיגרציה עדיין לא הופעלה."
      : null;

    return {
      gardens,
      profiles,
      staff,
      parents,
      documents,
      subscriptions,
      health,
      lifecycle,
      tickets,
      training,
      completions,
      knowledge,
      tasks,
      risks,
      playbooks,
      surveys,
      adoption,
      reports,
      readiness,
      activeGardens,
      onboardingGardens,
      openTickets,
      urgentTickets,
      atRisk,
      managerOnboarding,
      staffOnboarding,
      parentOnboarding,
      documentCompletion,
      paymentCompletion,
      trainingCompletion,
      averageHealth,
      queryError
    };
  }, {
    gardens: [] as any[],
    profiles: [] as any[],
    staff: [] as any[],
    parents: [] as any[],
    documents: [] as any[],
    subscriptions: [] as any[],
    health: [] as any[],
    lifecycle: [] as any[],
    tickets: [] as any[],
    training: [] as any[],
    completions: [] as any[],
    knowledge: [] as any[],
    tasks: [] as any[],
    risks: [] as any[],
    playbooks: [] as any[],
    surveys: [] as any[],
    adoption: [] as any[],
    reports: [] as any[],
    readiness: [] as any[],
    activeGardens: 0,
    onboardingGardens: 0,
    openTickets: 0,
    urgentTickets: 0,
    atRisk: 0,
    managerOnboarding: 0,
    staffOnboarding: 0,
    parentOnboarding: 0,
    documentCompletion: 0,
    paymentCompletion: 0,
    trainingCompletion: 0,
    averageHealth: 0,
    queryError: null as string | null
  });

  const data = result.data;
  const lowHealth = data.health.filter((row) => Number(row.customer_health_score ?? 0) < 62).slice(0, 8);
  const openTasks = data.tasks.filter((task) => !["completed", "cancelled"].includes(String(task.status)));

  return (
    <DashboardShell role="admin" title="Customer Success">
      <div className="commercial-dashboard analytics-center-shell">
        <PremiumDashboardHero
          eyebrow="Customer Success"
          title="מרכז הצלחת לקוחות, תמיכה והדרכה"
          subtitle="מעקב יזום אחרי קליטה, אימוץ, תמיכה, הדרכות, שביעות רצון, סיכוני חידוש ושימור לקוחות."
          badge={`${data.averageHealth}/100`}
          badgeTone={tone(data.averageHealth)}
          actions={<><Link className="button primary" href="/dashboard/admin/leads">לידים</Link><Link className="button secondary" href="/dashboard/admin/billing">חידושים</Link></>}
        >
          <div className="setup-checklist">
            <span>Proactive Support</span>
            <span>Training Hub</span>
            <span>Knowledge Base</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="בריאות לקוח" value={`${data.averageHealth}/100`} tone={tone(data.averageHealth)} />
          <RoleMetricCard label="גנים פעילים" value={data.activeGardens} tone="good" />
          <RoleMetricCard label="בקליטה" value={data.onboardingGardens} tone={data.onboardingGardens ? "warn" : "good"} />
          <RoleMetricCard label="סיכון חידוש" value={data.atRisk} tone={data.atRisk ? "bad" : "good"} />
          <RoleMetricCard label="פניות פתוחות" value={data.openTickets} tone={data.openTickets ? "warn" : "good"} hint={data.urgentTickets ? `${data.urgentTickets} דחופות` : undefined} />
          <RoleMetricCard label="השלמת צוות" value={`${data.staffOnboarding}%`} tone={tone(data.staffOnboarding)} />
          <RoleMetricCard label="אימוץ הורים" value={`${data.parentOnboarding}%`} tone={tone(data.parentOnboarding)} />
          <RoleMetricCard label="הדרכות" value={`${data.trainingCompletion}%`} tone={data.completions.length ? tone(data.trainingCompletion) : "warn"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><HeartHandshake size={20} /> לקוחות שדורשים תשומת לב</h2>
            {lowHealth.length === 0 ? <EmptyState title="אין לקוחות בסיכון נמוך כרגע" text="כאשר בריאות לקוח תרד, הלקוח יופיע כאן עם המלצה." /> : lowHealth.map((row) => (
              <div className="list-item" key={row.id}>
                <div><strong>{row.gardens?.name ?? "גן"}</strong><span>{row.explanation ?? "נדרש מעקב יזום"}</span></div>
                <StatusBadge tone={tone(Number(row.customer_health_score ?? 0))}>{row.customer_health_score}/100</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><TicketCheck size={20} /> תמיכה</h2>
            {data.tickets.length === 0 ? <EmptyState title="אין פניות תמיכה" text="פניות WhatsApp, מייל ותוך-מערכת יופיעו כאן." /> : data.tickets.slice(0, 8).map((ticket) => (
              <div className="list-item" key={ticket.id}>
                <div><strong>{ticket.subject}</strong><span>{ticket.gardens?.name ?? ticket.channel} · {date(ticket.created_at)}</span></div>
                <StatusBadge tone={tone(ticket.status)}>{statusLabel(ticket.status)}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <CleanSection title="קליטה ואימוץ" subtitle="מדדי הצלחה מהיום הראשון אחרי הפעלה.">
          <section className="grid cols-5 dashboard-kpis">
            <RoleMetricCard label="מנהלת" value={`${data.managerOnboarding}%`} tone={tone(data.managerOnboarding)} />
            <RoleMetricCard label="צוות" value={`${data.staffOnboarding}%`} tone={tone(data.staffOnboarding)} />
            <RoleMetricCard label="הורים" value={`${data.parentOnboarding}%`} tone={tone(data.parentOnboarding)} />
            <RoleMetricCard label="מסמכים" value={`${data.documentCompletion}%`} tone={tone(data.documentCompletion)} />
            <RoleMetricCard label="תשלום" value={`${data.paymentCompletion}%`} tone={tone(data.paymentCompletion)} />
          </section>
        </CleanSection>

        <section className="grid cols-3 dashboard-panels">
          <article className="card action-panel">
            <h2><GraduationCap size={20} /> Training Hub</h2>
            {data.training.length === 0 ? <div className="empty-mini">אין פריטי הדרכה.</div> : data.training.slice(0, 8).map((item) => (
              <div className="list-item" key={item.id}>
                <div><strong>{item.title}</strong><span>{item.audience_role} · {item.estimated_minutes} דקות</span></div>
                <StatusBadge tone={item.required_for_onboarding ? "warn" : "good"}>{item.content_type}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><BookOpenCheck size={20} /> Help Center</h2>
            {data.knowledge.length === 0 ? <div className="empty-mini">אין מאמרי ידע.</div> : data.knowledge.slice(0, 8).map((article) => (
              <div className="list-item" key={article.id}>
                <div><strong>{article.title}</strong><span>{article.summary}</span></div>
                <StatusBadge tone={tone(article.status)}>{article.category}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><RefreshCcw size={20} /> Playbooks</h2>
            {data.playbooks.length === 0 ? <div className="empty-mini">אין playbooks.</div> : data.playbooks.slice(0, 8).map((playbook) => (
              <div className="list-item" key={playbook.id}>
                <div><strong>{playbook.title}</strong><span>{playbook.description}</span></div>
                <StatusBadge tone="good">{playbook.playbook_type}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><AlertTriangle size={20} /> Renewal Risk</h2>
            {data.risks.length === 0 ? <EmptyState title="אין סיכוני חידוש פתוחים" text="ירידת שימוש, בעיות פתוחות ותשלומים יופיעו כאן." /> : data.risks.slice(0, 8).map((risk) => (
              <div className="list-item" key={risk.id}>
                <div><strong>{risk.gardens?.name ?? risk.signal_type}</strong><span>{risk.explanation ?? risk.recommended_action}</span></div>
                <StatusBadge tone={tone(risk.severity)}>{risk.risk_score}/100</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Sparkles size={20} /> Customer Success AI</h2>
            <div className="parent-trust-list">
              <span>מי בסיכון? {data.atRisk ? `${data.atRisk} לקוחות דורשים בדיקה.` : "אין סיכון גבוה כרגע."}</span>
              <span>מה חסר בקליטה? צוות {data.staffOnboarding}%, הורים {data.parentOnboarding}%, מסמכים {data.documentCompletion}%.</span>
              <span>מה לפתור קודם? {data.urgentTickets ? `${data.urgentTickets} פניות דחופות.` : openTasks.length ? `${openTasks.length} משימות פתוחות.` : "אין חסם דחוף."}</span>
            </div>
          </article>
        </section>

        <CleanSection title="משימות ודוחות הצלחה" subtitle="מעקב אחר follow-up, הדרכה, חידוש ושימור.">
          <section className="grid cols-2 dashboard-panels">
            <article className="card action-panel">
              <h2><LifeBuoy size={20} /> משימות Customer Success</h2>
              {openTasks.length === 0 ? <EmptyState title="אין משימות פתוחות" text="משימות מעקב, תשלום, מסמכים וחידוש יופיעו כאן." /> : openTasks.slice(0, 8).map((task) => (
                <div className="list-item" key={task.id}>
                  <div><strong>{task.title}</strong><span>{task.gardens?.name ?? task.task_type} · {task.due_at ? date(task.due_at) : "ללא יעד"}</span></div>
                  <StatusBadge tone={tone(task.status)}>{statusLabel(task.status)}</StatusBadge>
                </div>
              ))}
            </article>
            <article className="card action-panel">
              <h2><LineChart size={20} /> דוחות וסקרים</h2>
              {[...data.reports, ...data.surveys].length === 0 ? <EmptyState title="אין דוחות או סקרים" text="סקרי NPS, שביעות רצון ודוחות אימוץ יופיעו כאן." /> : [...data.reports, ...data.surveys].slice(0, 8).map((item) => (
                <div className="list-item" key={item.id}>
                  <div><strong>{item.title ?? item.report_type}</strong><span>{item.summary ?? item.gardens?.name ?? item.survey_type}</span></div>
                  <StatusBadge tone={tone(item.status ?? item.satisfaction_score ?? 0)}>{item.status ?? `${item.satisfaction_score ?? 0}/5`}</StatusBadge>
                </div>
              ))}
            </article>
          </section>
        </CleanSection>

        <CleanSection title="Product Adoption" subtitle="שימוש בפיצ׳רים לפי הורים, צוות, מצלמות, AI, מסמכים ותשלומים.">
          {data.adoption.length === 0 ? <EmptyState title="אין עדיין נתוני אימוץ" text="לאחר הפעלת analytics תקופתיים יופיעו כאן שימושים ופיצ׳רים לא מנוצלים." /> : (
            <div className="analytics-region-grid">
              {data.adoption.slice(0, 12).map((item) => (
                <article key={item.id}>
                  <LineChart />
                  <strong>{item.feature_key}</strong>
                  <span>{item.gardens?.name ?? item.feature_category}</span>
                  <small>{item.usage_count} שימושים · {item.active_users} משתמשים · אימוץ {item.adoption_score}/100</small>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="לידים" text="המשך קליטה" href="/dashboard/admin/leads" icon={UsersRound} />
          <ActionCard title="הפעלת גנים" text="סטטוס קליטה" href="/dashboard/admin/kindergarten-activation" icon={PlayCircle} />
          <ActionCard title="תקשורת" text="הודעות ועדכונים" href="/dashboard/admin/communications" icon={MessageCircle} />
          <ActionCard title="משימות" text="מעקב פעולות" href="/dashboard/tasks" icon={LifeBuoy} />
          <ActionCard title="דוחות" text="אימוץ ושימור" href="/dashboard/admin/reports" icon={LineChart} />
          <ActionCard title="חיפוש ידע" text="מאגר הדרכה" href="/dashboard/admin/customer-success" icon={Search} />
        </section>
      </div>
    </DashboardShell>
  );
}
