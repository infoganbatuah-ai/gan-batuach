import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, ListChecks, Search, ShieldCheck, UserRoundCheck, Workflow } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";

type Row = Record<string, any>;

const statusLabels: Record<string, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  waiting_approval: "ממתין לאישור",
  blocked: "חסום",
  overdue: "באיחור",
  done: "בוצע",
  completed: "הושלם",
  rejected: "הוחזר",
  cancelled: "בוטל"
};

const priorityLabels: Record<string, string> = {
  low: "רגיל",
  medium: "חשוב",
  high: "דחוף",
  critical: "קריטי"
};

const typeLabels: Record<string, string> = {
  inspection: "פיקוח",
  compliance: "ציות",
  incident: "אירוע",
  document_renewal: "מסמך",
  communication: "תקשורת",
  onboarding: "קליטה",
  ai_recommendation: "המלצת מערכת",
  observer_alert: "תצפיתן",
  general: "כללי",
  admin: "משימה",
  recurring: "חוזרת"
};

function toneFor(value?: string | null): "default" | "good" | "warn" | "bad" {
  const text = String(value ?? "");
  if (["critical", "high", "blocked", "overdue", "rejected"].includes(text)) return "bad";
  if (["medium", "waiting_approval", "open", "in_progress"].includes(text)) return "warn";
  if (["low", "done", "completed"].includes(text)) return "good";
  return "default";
}

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "ללא יעד";
}

function roleTitle(role: string) {
  const labels: Record<string, string> = {
    admin: "משימות הנהלה",
    manager: "משימות ניהול",
    owner: "משימות ניהול",
    staff: "משימות צוות",
    inspector: "משימות פיקוח"
  };
  return labels[role] ?? "המשימות שלי";
}

export default async function UnifiedTasksPage() {
  const { profile } = await requireOperationalRole(["admin", "network_manager", "manager", "owner", "staff", "inspector"]);
  const supabase = await createClient();
  const role = String(profile.role) as UserRole;
  const gardenId = profile.garden_id ?? "";

  let taskQuery = supabase.from("tasks" as any)
    .select("id,garden_id,title,description,assigned_to,assigned_role,due_at,status,priority,task_type,source_entity_type,source_entity_id,completed_at,created_at,gardens(name,city),profiles:assigned_to(full_name,role)")
    .order("created_at", { ascending: false }).limit(160);
  if (role === "staff") taskQuery = taskQuery.eq("garden_id", gardenId).eq("assigned_to", profile.id);
  if (["manager", "owner"].includes(role)) taskQuery = taskQuery.eq("garden_id", gardenId);
  const taskRes = await taskQuery;
  let rows = (taskRes.data ?? []) as Row[];
  const queryError = taskRes.error ? "לא ניתן לטעון משימות כרגע." : null;

  if (role !== "admin") {
    rows = rows.filter((task) => {
      if (role === "inspector") return task.garden_id && (task.assigned_to === profile.id || task.assigned_role === "inspector");
      return true;
    });
  }

  const now = Date.now();
  const openRows = rows.filter((task) => !["done", "completed", "cancelled"].includes(String(task.status)));
  const overdueRows = openRows.filter((task) => task.status === "overdue" || (task.due_at && new Date(task.due_at).getTime() < now));
  const approvalRows = rows.filter((task) => task.status === "waiting_approval" || task.requires_approval);
  const blockedRows = rows.filter((task) => ["blocked", "rejected"].includes(String(task.status)));
  const doneRows = rows.filter((task) => ["done", "completed"].includes(String(task.status)));
  const completionRate = rows.length ? Math.round((doneRows.length / rows.length) * 100) : 100;

  return (
    <DashboardShell role={role} title="משימות">
      <div className="commercial-dashboard unified-task-center">
        <PremiumDashboardHero
          eyebrow="תיבת עבודה"
          title={roleTitle(role)}
          subtitle="כל המשימות, האישורים והמעקבים במקום אחד. מסודר לפי דחיפות, יעד ואחריות."
          badge={overdueRows.length ? `${overdueRows.length} באיחור` : "מסודר"}
          badgeTone={overdueRows.length ? "bad" : "good"}
          actions={<><Link className="button primary" href={role === "admin" ? "/dashboard/admin/workflows" : "#tasks-list"}>מה דורש טיפול</Link>{role === "admin" ? <Link className="button secondary" href="/dashboard/admin/tasks">יצירת משימה</Link> : null}</>}
        >
          <div className="setup-checklist"><span>אחריות</span><span>יעד</span><span>מעקב</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={queryError} />

        <section className="task-kpi-grid">
          <RoleMetricCard label="פתוחות" value={openRows.length} tone={openRows.length ? "warn" : "good"} />
          <RoleMetricCard label="באיחור" value={overdueRows.length} tone={overdueRows.length ? "bad" : "good"} />
          <RoleMetricCard label="אישור" value={approvalRows.length} tone={approvalRows.length ? "warn" : "good"} />
          <RoleMetricCard label="חסומות" value={blockedRows.length} tone={blockedRows.length ? "bad" : "good"} />
          <RoleMetricCard label="הושלמו" value={doneRows.length} tone="good" />
          <RoleMetricCard label="קצב השלמה" value={`${completionRate}%`} tone={completionRate < 70 ? "warn" : "good"} />
        </section>

        <section className="workflow-command-grid">
          <article className="workflow-focus-card">
            <div><AlertTriangle /><span>דחוף</span></div>
            <strong>{overdueRows.length + blockedRows.length}</strong>
            <p>איחורים או חסימות שדורשים טיפול.</p>
          </article>
          <article className="workflow-focus-card">
            <div><FileCheck2 /><span>אישורים</span></div>
            <strong>{approvalRows.length}</strong>
            <p>משימות שממתינות לבדיקה או אישור.</p>
          </article>
          <article className="workflow-focus-card">
            <div><Clock3 /><span>היום</span></div>
            <strong>{openRows.filter((task) => task.due_at && new Date(task.due_at).toDateString() === new Date().toDateString()).length}</strong>
            <p>משימות עם יעד להיום.</p>
          </article>
          <article className="workflow-focus-card">
            <div><CheckCircle2 /><span>בוצע</span></div>
            <strong>{doneRows.length}</strong>
            <p>משימות שהושלמו ומתועדות.</p>
          </article>
        </section>

        <CleanSection title="רשימת משימות" subtitle="מסונן לפי ההרשאה והתפקיד שלך." action={<span className="task-search-hint"><Search size={16} /> חיפוש טבעי מוכן לשלב הבא</span>}>
          <div id="tasks-list">
            {rows.length === 0 ? <EmptyState title="אין משימות כרגע" text="כשתיווצר משימה עבורך היא תופיע כאן עם יעד, עדיפות והקשר." /> : (
              <div className="unified-task-list">
                {rows.map((task) => (
                  <article className="unified-task-row" key={task.id}>
                    <div className="unified-task-main">
                      <span><Workflow size={16} /> {typeLabels[task.task_type] ?? task.task_type ?? "כללי"}</span>
                      <strong>{task.title}</strong>
                      <p>{task.description ?? "אין פירוט נוסף"}</p>
                      <small>{task.gardens?.name ?? "כללי"} · אחראי: {task.profiles?.full_name ?? task.assigned_role ?? "לא שויך"}</small>
                    </div>
                    <div className="unified-task-meta">
                      <StatusBadge tone={toneFor(task.priority)}>{priorityLabels[task.priority] ?? task.priority ?? "חשוב"}</StatusBadge>
                      <StatusBadge tone={toneFor(task.status)}>{statusLabels[task.status] ?? task.status ?? "פתוח"}</StatusBadge>
                      <span>{dateText(task.due_at)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </CleanSection>

        <section className="quick-actions-grid">
          {role === "admin" ? <Link className="premium-action-card" href="/dashboard/admin/workflows"><ListChecks /><strong>מרכז עבודה</strong><span>תהליכים ואוטומציה</span></Link> : null}
          {["manager", "owner", "admin"].includes(role) ? <Link className="premium-action-card" href="/dashboard/garden/command-center"><UserRoundCheck /><strong>ניהול היום</strong><span>מצב הגן</span></Link> : null}
          {["inspector", "admin"].includes(role) ? <Link className="premium-action-card" href="/dashboard/inspector/command-center"><ShieldCheck /><strong>פיקוח</strong><span>בדיקות וליקויים</span></Link> : null}
          <Link className="premium-action-card" href={role === "staff" ? "/dashboard/staff/operations" : "/dashboard"}><CheckCircle2 /><strong>חזרה לעבודה</strong><span>המסך הראשי שלך</span></Link>
        </section>
      </div>
    </DashboardShell>
  );
}
