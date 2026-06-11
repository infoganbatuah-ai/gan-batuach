import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, ClipboardCheck, Clock3, FileCheck2, GitBranch, ListChecks, RefreshCw, ShieldCheck, TimerReset, Workflow } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;

const statusLabels: Record<string, string> = {
  draft: "טיוטה",
  active: "פעיל",
  waiting_approval: "ממתין לאישור",
  blocked: "חסום",
  overdue: "באיחור",
  completed: "הושלם",
  closed: "נסגר",
  cancelled: "בוטל",
  open: "פתוח",
  in_progress: "בטיפול",
  done: "בוצע",
  rejected: "הוחזר",
  pending: "ממתין",
  approved: "אושר",
  returned: "הוחזר לתיקון",
  testing: "בבדיקה",
  ready: "מוכן",
  disabled: "כבוי",
  failed: "דורש בדיקה"
};

const typeLabels: Record<string, string> = {
  onboarding: "קליטה",
  inspection: "פיקוח",
  complaint: "פנייה",
  incident: "אירוע",
  compliance: "ציות",
  document_renewal: "מסמכים",
  communication: "תקשורת",
  ai_recommendation: "המלצת מערכת",
  observer_alert: "תצפיתן",
  general: "כללי"
};

function toneFor(value?: string | null): "default" | "good" | "warn" | "bad" {
  const text = String(value ?? "");
  if (["critical", "high", "blocked", "overdue", "failed", "rejected"].includes(text)) return "bad";
  if (["medium", "waiting_approval", "pending", "returned", "testing", "open", "in_progress"].includes(text)) return "warn";
  if (["low", "active", "completed", "closed", "done", "approved", "ready"].includes(text)) return "good";
  return "default";
}

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "לא נקבע";
}

export default async function AdminWorkflowsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("workflow command center", async () => {
    const supabase = await createClient();
    const [workflowsRes, tasksRes, approvalsRes, automationsRes, escalationsRes, templatesRes, slaRes, auditRes] = await Promise.all([
      supabase.from("workflows" as any).select("*, gardens(name,city)").order("created_at", { ascending: false }).limit(220),
      supabase.from("workflow_tasks" as any).select("*, gardens(name,city), profiles:assigned_to(full_name,role)").order("created_at", { ascending: false }).limit(320),
      supabase.from("workflow_approvals" as any).select("*").order("requested_at", { ascending: false }).limit(120),
      supabase.from("workflow_automation_rules" as any).select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("workflow_escalations" as any).select("*, gardens(name,city)").order("created_at", { ascending: false }).limit(160),
      supabase.from("workflow_templates" as any).select("*").eq("active", true).order("workflow_type"),
      supabase.from("workflow_sla_rules" as any).select("*").eq("active", true).order("workflow_type"),
      supabase.from("workflow_audit_events" as any).select("*").order("created_at", { ascending: false }).limit(120)
    ]);
    [workflowsRes, tasksRes, approvalsRes, automationsRes, escalationsRes, templatesRes, slaRes, auditRes].forEach((query, index) => logSupabaseError(`workflow query ${index}`, (query as any).error));
    const workflows = (workflowsRes.data ?? []) as Row[];
    const tasks = (tasksRes.data ?? []) as Row[];
    const approvals = (approvalsRes.data ?? []) as Row[];
    const automations = (automationsRes.data ?? []) as Row[];
    const escalations = (escalationsRes.data ?? []) as Row[];
    const templates = (templatesRes.data ?? []) as Row[];
    const slaRules = (slaRes.data ?? []) as Row[];
    const audit = (auditRes.data ?? []) as Row[];
    const activeWorkflows = workflows.filter((item) => ["active", "waiting_approval", "blocked", "overdue"].includes(String(item.status)));
    const overdueTasks = tasks.filter((task) => task.status === "overdue" || (task.due_at && new Date(task.due_at).getTime() < Date.now() && task.status !== "done"));
    const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
    const openEscalations = escalations.filter((item) => ["open", "acknowledged"].includes(String(item.status)));
    const completionRate = tasks.length ? Math.round((tasks.filter((task) => ["done", "completed", "closed"].includes(String(task.status))).length / tasks.length) * 100) : 100;
    const automationReady = automations.filter((rule) => ["ready", "active"].includes(String(rule.status))).length;
    const workflowHealth = Math.max(0, Math.min(100, 100 - overdueTasks.length * 4 - openEscalations.length * 5 - pendingApprovals.length * 2));
    return {
      workflows,
      tasks,
      approvals,
      automations,
      escalations,
      templates,
      slaRules,
      audit,
      activeWorkflows,
      overdueTasks,
      pendingApprovals,
      openEscalations,
      completionRate,
      automationReady,
      workflowHealth,
      queryError: [workflowsRes.error, tasksRes.error, approvalsRes.error, automationsRes.error, escalationsRes.error].some(Boolean) ? "חלק מנתוני העבודה לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null
    };
  }, {
    workflows: [] as Row[],
    tasks: [] as Row[],
    approvals: [] as Row[],
    automations: [] as Row[],
    escalations: [] as Row[],
    templates: [] as Row[],
    slaRules: [] as Row[],
    audit: [] as Row[],
    activeWorkflows: [] as Row[],
    overdueTasks: [] as Row[],
    pendingApprovals: [] as Row[],
    openEscalations: [] as Row[],
    completionRate: 100,
    automationReady: 0,
    workflowHealth: 100,
    queryError: null as string | null
  });

  const data = result.data;
  const blockedTasks = data.tasks.filter((task) => ["blocked", "rejected"].includes(String(task.status)));
  const recentTasks = data.tasks.slice(0, 10);
  const healthTone = data.workflowHealth < 70 ? "bad" : data.workflowHealth < 86 ? "warn" : "good";

  return (
    <DashboardShell role="admin" title="Workflows">
      <div className="commercial-dashboard workflow-command-center">
        <PremiumDashboardHero
          eyebrow="מרכז עבודה"
          title="כל המשימות והתהליכים במקום אחד"
          subtitle="מעקב אחיד אחרי קליטה, פיקוח, ציות, אירועים, מסמכים, תקשורת והמלצות מערכת."
          badge={`${data.workflowHealth}/100`}
          badgeTone={healthTone}
          actions={<><Link className="button primary" href="/dashboard/tasks">תיבת המשימות</Link><Link className="button secondary" href="/dashboard/admin/tasks">יצירת משימה</Link></>}
        >
          <div className="setup-checklist"><span>אחיד</span><span>מדיד</span><span>מתועד</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="workflow-kpi-grid">
          <RoleMetricCard label="תהליכים פעילים" value={data.activeWorkflows.length} tone={data.activeWorkflows.length ? "warn" : "good"} />
          <RoleMetricCard label="באיחור" value={data.overdueTasks.length} tone={data.overdueTasks.length ? "bad" : "good"} />
          <RoleMetricCard label="ממתין לאישור" value={data.pendingApprovals.length} tone={data.pendingApprovals.length ? "warn" : "good"} />
          <RoleMetricCard label="אוטומציה מוכנה" value={data.automationReady} tone={data.automationReady ? "good" : "warn"} />
          <RoleMetricCard label="השלמה" value={`${data.completionRate}%`} tone={data.completionRate < 75 ? "warn" : "good"} />
          <RoleMetricCard label="הסלמות" value={data.openEscalations.length} tone={data.openEscalations.length ? "bad" : "good"} />
        </section>

        <section className="workflow-command-grid">
          <article className="workflow-focus-card">
            <div><AlertTriangle /><span>דורש טיפול עכשיו</span></div>
            <strong>{data.overdueTasks.length + data.pendingApprovals.length + data.openEscalations.length}</strong>
            <p>איחורים, אישורים והסלמות שצריכים מענה.</p>
          </article>
          <article className="workflow-focus-card">
            <div><GitBranch /><span>מנוע תהליכים</span></div>
            <strong>{data.templates.length}</strong>
            <p>תבניות עבודה מוכנות לקליטה, פיקוח, מסמכים ואירועים.</p>
          </article>
          <article className="workflow-focus-card">
            <div><TimerReset /><span>יעדי שירות</span></div>
            <strong>{data.slaRules.length}</strong>
            <p>זמני תגובה, השלמה והסלמה לפי סוג ועדיפות.</p>
          </article>
          <article className="workflow-focus-card">
            <div><ShieldCheck /><span>תיעוד</span></div>
            <strong>{data.audit.length}</strong>
            <p>פעולות אחרונות נשמרות לבקרה ובדיקה.</p>
          </article>
        </section>

        <section className="workflow-layout">
          <CleanSection title="תיבת עבודה אחידה" subtitle="כל משימה מקבלת יעד, אחריות, סטטוס ותהליך.">
            {recentTasks.length === 0 ? <EmptyState title="אין משימות להצגה" text="כאשר תיווצר משימה מכל מודול, היא תופיע כאן." action={<Link className="button secondary" href="/dashboard/admin/tasks">יצירת משימה</Link>} /> : (
              <div className="workflow-task-list">
                {recentTasks.map((task) => (
                  <Link className="workflow-task-row" href="/dashboard/tasks" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <span>{typeLabels[task.task_type] ?? task.task_type ?? "כללי"} · {task.gardens?.name ?? "כללי"} · {task.profiles?.full_name ?? task.assigned_role ?? "ללא שיוך"}</span>
                    </div>
                    <StatusBadge tone={toneFor(task.priority)}>{task.priority}</StatusBadge>
                    <StatusBadge tone={toneFor(task.status)}>{statusLabels[task.status] ?? task.status}</StatusBadge>
                    <small>{dateText(task.due_at)}</small>
                  </Link>
                ))}
              </div>
            )}
          </CleanSection>

          <aside className="workflow-side-panel">
            <article className="card action-panel">
              <h2><FileCheck2 size={20} /> אישורים</h2>
              {data.pendingApprovals.length === 0 ? <div className="empty-mini">אין אישורים ממתינים.</div> : data.pendingApprovals.slice(0, 5).map((approval) => (
                <div className="list-item" key={approval.id}><div><strong>{approval.approval_type}</strong><span>{dateText(approval.requested_at)}</span></div><StatusBadge tone="warn">ממתין</StatusBadge></div>
              ))}
            </article>
            <article className="card action-panel">
              <h2><RefreshCw size={20} /> אוטומציה</h2>
              {data.automations.length === 0 ? <div className="empty-mini">אין כללי אוטומציה.</div> : data.automations.slice(0, 5).map((rule) => (
                <div className="list-item" key={rule.id}><div><strong>{rule.name}</strong><span>{rule.description}</span></div><StatusBadge tone={toneFor(rule.status)}>{statusLabels[rule.status] ?? rule.status}</StatusBadge></div>
              ))}
            </article>
          </aside>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Clock3 size={20} /> איחורים והסלמות</h2>
            {data.openEscalations.length === 0 && data.overdueTasks.length === 0 ? <div className="empty-mini">אין הסלמות פתוחות.</div> : [...data.openEscalations, ...data.overdueTasks].slice(0, 8).map((item) => (
              <div className="list-item" key={`${item.id}-${item.title ?? item.reason}`}>
                <div><strong>{item.reason ?? item.title}</strong><span>{item.gardens?.name ?? "כללי"} · {dateText(item.due_at ?? item.created_at)}</span></div>
                <StatusBadge tone={toneFor(item.severity ?? item.priority)}>{item.severity ?? item.priority ?? "medium"}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Bot size={20} /> עוזר עבודה</h2>
            <div className="workflow-assistant-prompts">
              <Link href="/dashboard/admin/workflows">מה באיחור?</Link>
              <Link href="/dashboard/admin/workflows">מה ממתין לאישור?</Link>
              <Link href="/dashboard/admin/workflows">איפה יש צוואר בקבוק?</Link>
              <Link href="/dashboard/admin/workflows">מה דורש טיפול היום?</Link>
            </div>
          </article>
        </section>

        <CleanSection title="תבניות עבודה" subtitle="תהליכים חוזרים שניתן להפעיל מכל מודול.">
          <div className="workflow-template-grid">
            {data.templates.map((template) => (
              <article className="workflow-template-card" key={template.id}>
                <ClipboardCheck />
                <strong>{template.name}</strong>
                <span>{typeLabels[template.workflow_type] ?? template.workflow_type}</span>
                <p>{template.description}</p>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="תיבת משימות" text="כל המשימות שלי" href="/dashboard/tasks" icon={ListChecks} />
          <ActionCard title="יצירת משימה" text="הקצאה ידנית" href="/dashboard/admin/tasks" icon={ClipboardCheck} />
          <ActionCard title="ציות" text="פעולות תיקון" href="/dashboard/admin/compliance-center" icon={ShieldCheck} />
          <ActionCard title="פיקוח" text="ליקויים והמשך טיפול" href="/dashboard/admin/national-inspections" icon={FileCheck2} />
          <ActionCard title="אירועים" text="תיקי טיפול" href="/dashboard/admin/incident-center" icon={AlertTriangle} />
          <ActionCard title="תקשורת" text="פניות ומענה" href="/dashboard/admin/communications" icon={Workflow} />
        </section>
      </div>
    </DashboardShell>
  );
}
