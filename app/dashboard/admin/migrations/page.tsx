import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  DatabaseZap,
  FileSpreadsheet,
  History,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TableProperties,
  UploadCloud
} from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function toneForStatus(status?: string | null) {
  if (["completed", "preview_ready", "configured", "production_ready", "active"].includes(String(status))) return "good" as const;
  if (["failed", "critical", "error"].includes(String(status))) return "bad" as const;
  if (["validating", "awaiting_confirmation", "importing", "warning", "test_mode"].includes(String(status))) return "warn" as const;
  return "default" as const;
}

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    draft: "טיוטה",
    uploaded: "הועלה",
    validating: "בבדיקה",
    preview_ready: "תצוגה מוכנה",
    awaiting_confirmation: "ממתין לאישור",
    importing: "מייבא",
    completed: "הושלם",
    failed: "נכשל",
    rolled_back: "שוחזר",
    cancelled: "בוטל",
    planned: "מתוכנן",
    running: "בתהליך",
    configured: "מוכן",
    not_configured: "לא הוגדר",
    test_mode: "בדיקה",
    active: "פעיל",
    disabled: "כבוי"
  };
  return map[String(status ?? "")] ?? "ממתין";
}

function entityLabel(entity?: string | null) {
  const map: Record<string, string> = {
    child: "ילדים",
    parent: "הורים",
    staff: "צוות",
    document: "מסמכים",
    payment: "תשלומים",
    invoice: "חשבוניות",
    receipt: "קבלות",
    authorized_pickup: "מורשי איסוף",
    communication_preference: "העדפות תקשורת"
  };
  return map[String(entity ?? "")] ?? "נתונים";
}

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Date(value).toLocaleDateString("he-IL");
}

type MigrationData = {
  batches: any[];
  issues: any[];
  rollbacks: any[];
  templates: any[];
  connectors: any[];
  quality: any[];
  previews: any[];
};

const emptyData: MigrationData = { batches: [], issues: [], rollbacks: [], templates: [], connectors: [], quality: [], previews: [] };

export default async function AdminMigrationsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("data migrations", async () => {
    const supabase = await createClient();
    const [batchesRes, issuesRes, rollbacksRes, templatesRes, connectorsRes, qualityRes, previewsRes] = await Promise.all([
      supabase.from("data_migration_batches" as any).select("id,batch_name,garden_id,network_name,source_type,source_system,status,total_records,records_to_create,records_to_update,validation_error_count,warning_count,imported_count,duplicate_count,correction_rate,rollback_available,created_at,gardens(name,city)").order("created_at", { ascending: false }).limit(40),
      supabase.from("data_migration_validation_issues" as any).select("id,batch_id,entity_type,issue_type,severity,field_name,message,suggested_fix,resolved,created_at,data_migration_batches(batch_name,gardens(name,city))").eq("resolved", false).order("created_at", { ascending: false }).limit(80),
      supabase.from("data_migration_rollback_events" as any).select("id,batch_id,rollback_type,status,affected_entity_type,affected_records,reason,created_at,executed_at,data_migration_batches(batch_name)").order("created_at", { ascending: false }).limit(40),
      supabase.from("data_mapping_templates" as any).select("id,template_name,source_system,entity_type,required_fields,active,updated_at").eq("active", true).order("entity_type", { ascending: true }).limit(80),
      supabase.from("external_system_connectors" as any).select("id,connector_key,connector_name,connector_type,status,supported_entities,auth_mode,last_test_status,notes,updated_at").order("connector_type", { ascending: true }).limit(80),
      supabase.from("data_quality_snapshots" as any).select("id,garden_id,scope_type,overall_score,completeness_score,duplicate_score,relationship_score,document_score,missing_data_count,invalid_records_count,duplicate_records_count,calculated_at,gardens(name,city)").order("calculated_at", { ascending: false }).limit(30),
      supabase.from("data_migration_preview_rows" as any).select("id,batch_id,entity_type,action_type,validation_status,target_table,created_at,data_migration_batches(batch_name)").order("created_at", { ascending: false }).limit(120)
    ]);
    [batchesRes, issuesRes, rollbacksRes, templatesRes, connectorsRes, qualityRes, previewsRes].forEach((query, index) => logSupabaseError(`data migrations query ${index}`, (query as any).error));
    return {
      batches: (batchesRes.data ?? []) as any[],
      issues: (issuesRes.data ?? []) as any[],
      rollbacks: (rollbacksRes.data ?? []) as any[],
      templates: (templatesRes.data ?? []) as any[],
      connectors: (connectorsRes.data ?? []) as any[],
      quality: (qualityRes.data ?? []) as any[],
      previews: (previewsRes.data ?? []) as any[]
    };
  }, emptyData);

  const { batches, issues, rollbacks, templates, connectors, quality, previews } = result.data;
  const activeImports = batches.filter((batch) => ["uploaded", "validating", "preview_ready", "awaiting_confirmation", "importing"].includes(String(batch.status)));
  const completedImports = batches.filter((batch) => batch.status === "completed");
  const failedImports = batches.filter((batch) => ["failed", "rolled_back"].includes(String(batch.status)));
  const validationErrors = issues.filter((issue) => ["error", "critical"].includes(String(issue.severity)));
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const rollbackReady = batches.filter((batch) => batch.rollback_available).length;
  const previewCreate = previews.filter((row) => row.action_type === "create").length;
  const previewUpdate = previews.filter((row) => row.action_type === "update").length;
  const duplicateRows = previews.filter((row) => row.validation_status === "duplicate").length;
  const configuredConnectors = connectors.filter((connector) => ["configured", "test_mode", "production_ready", "active"].includes(String(connector.status))).length;
  const qualityScore = quality.length ? Math.round(quality.reduce((sum, item) => sum + Number(item.overall_score ?? 0), 0) / quality.length) : 0;

  return (
    <DashboardShell role="admin" title="מרכז מיגרציות">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Migration Center"
          title="מעבר מהיר ובטוח לגן בטוח"
          subtitle="ייבוא ילדים, הורים, צוות, מסמכים ותשלומים עם תצוגה מקדימה, בדיקות איכות ויכולת שחזור."
          badge={`${qualityScore}/100`}
          badgeTone={qualityScore >= 80 ? "good" : qualityScore >= 55 ? "warn" : "bad"}
          actions={<Link className="button primary" href="/dashboard/admin/migrations#new-import">הכנת יבוא</Link>}
        >
          <div className="setup-checklist">
            <span>Preview חובה</span>
            <span>Validation לפני כתיבה</span>
            <span>Rollback מתועד</span>
          </div>
        </PremiumDashboardHero>

        <AdminDataError message={result.error} />

        <section className="grid cols-5 dashboard-kpis">
          <RoleMetricCard label="ייבוא פעיל" value={activeImports.length} hint="ממתין או בבדיקה" tone={activeImports.length ? "warn" : "good"} />
          <RoleMetricCard label="הושלמו" value={completedImports.length} hint={`${completedImports.reduce((sum, batch) => sum + Number(batch.imported_count ?? 0), 0)} רשומות`} tone="good" />
          <RoleMetricCard label="נכשלו" value={failedImports.length} hint="דורש טיפול" tone={failedImports.length ? "bad" : "good"} />
          <RoleMetricCard label="בעיות ולידציה" value={validationErrors.length} hint={`${warnings.length} אזהרות`} tone={validationErrors.length ? "bad" : warnings.length ? "warn" : "good"} />
          <RoleMetricCard label="Rollback" value={rollbackReady} hint={`${rollbacks.length} פעולות`} tone={rollbackReady ? "warn" : "default"} />
        </section>

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="ליצירה" value={previewCreate} hint="בתצוגה מקדימה" />
          <RoleMetricCard label="לעדכון" value={previewUpdate} hint="דורש אישור" tone={previewUpdate ? "warn" : "default"} />
          <RoleMetricCard label="כפילויות" value={duplicateRows} hint="לבדיקה ידנית" tone={duplicateRows ? "warn" : "good"} />
          <RoleMetricCard label="חיבורים מוכנים" value={`${configuredConnectors}/${connectors.length}`} hint="Excel, Sheets ועוד" tone={configuredConnectors ? "good" : "warn"} />
        </section>

        <section className="grid cols-4 action-grid" id="new-import">
          <ActionCard title="ייבוא ילדים" text="CSV, Excel או Sheets" href="/dashboard/admin/migrations#templates" icon={FileSpreadsheet} tone="good" />
          <ActionCard title="ייבוא הורים" text="אנשי קשר והרשאות איסוף" href="/dashboard/admin/migrations#templates" icon={UploadCloud} />
          <ActionCard title="ייבוא צוות" text="תפקידים ותעודות" href="/dashboard/admin/migrations#templates" icon={ShieldCheck} />
          <ActionCard title="מסמכים ותשלומים" text="קבצים, יתרות וקבלות" href="/dashboard/admin/migrations#connectors" icon={DatabaseZap} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="יבואים אחרונים" subtitle="כל יבוא נשאר במצב preview עד אישור מפורש.">
            {batches.length ? <div className="stack-list">{batches.slice(0, 10).map((batch) => <article className="list-item" key={batch.id}><div><strong>{batch.batch_name}</strong><span>{batch.gardens?.name ?? batch.network_name ?? "לא שויך"} · {batch.source_type} · {dateText(batch.created_at)}</span><small>{batch.total_records} רשומות · יצירה {batch.records_to_create} · עדכון {batch.records_to_update}</small></div><StatusBadge tone={toneForStatus(batch.status)}>{statusLabel(batch.status)}</StatusBadge></article>)}</div> : <EmptyState title="אין יבואים עדיין" text="ברגע שיועלה קובץ, הוא יופיע כאן לפני כתיבה למערכת." />}
          </CleanSection>

          <CleanSection title="בעיות איכות וולידציה" subtitle="כפילויות, שדות חסרים, פורמטים וקשרים לא תקינים.">
            {issues.length ? <div className="stack-list">{issues.slice(0, 10).map((issue) => <article className="list-item" key={issue.id}><div><strong>{issue.message}</strong><span>{entityLabel(issue.entity_type)} · {issue.field_name ?? "כללי"}</span><small>{issue.suggested_fix ?? issue.data_migration_batches?.batch_name ?? "דורש תיקון לפני יבוא"}</small></div><StatusBadge tone={issue.severity === "critical" || issue.severity === "error" ? "bad" : "warn"}>{issue.severity}</StatusBadge></article>)}</div> : <EmptyState title="אין בעיות פתוחות" text="דוחות ולידציה יופיעו כאן אחרי parsing של קבצים." />}
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="תבניות מיפוי" subtitle="שדה חיצוני → שדה בגן בטוח. תבניות ניתנות לשימוש חוזר." action={<StatusBadge tone="good">{templates.length} תבניות</StatusBadge>}>
            <div className="migration-template-grid" id="templates">
              {templates.map((template) => <article className="card mini-card" key={template.id}><TableProperties size={20} /><strong>{template.template_name}</strong><span>{entityLabel(template.entity_type)} · {template.source_system ?? "ייבוא"}</span><small>חובה: {(template.required_fields ?? []).join(", ") || "לא הוגדר"}</small></article>)}
            </div>
          </CleanSection>

          <CleanSection title="חיבורים חיצוניים" subtitle="הכנה ל־Excel, Google Sheets, הנהלת חשבונות, CRM ומערכות עירוניות." action={<StatusBadge tone={configuredConnectors ? "good" : "warn"}>{configuredConnectors} מוכנים</StatusBadge>}>
            <div className="stack-list" id="connectors">
              {connectors.map((connector) => <article className="list-item" key={connector.id}><div><strong>{connector.connector_name}</strong><span>{connector.connector_type} · {connector.auth_mode}</span><small>{connector.notes ?? "ממתין להגדרה"}</small></div><StatusBadge tone={toneForStatus(connector.status)}>{statusLabel(connector.status)}</StatusBadge></article>)}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-3 dashboard-panels">
          <CleanSection title="תהליך יבוא בטוח" subtitle="אין כתיבה לפני אישור.">
            <div className="procedure-list">
              {[
                ["1", "העלאה", "Excel, CSV, Google Sheets export או חבילת מסמכים."],
                ["2", "מיפוי", "בחירת תבנית או התאמת שדות ידנית."],
                ["3", "בדיקה", "כפילויות, חסרים, פורמטים וקשרים."],
                ["4", "Preview", "מה ייווצר, מה יתעדכן ומה יידרש לתיקון."],
                ["5", "אישור", "אדמין מאשר לפני כתיבה."],
                ["6", "Rollback", "שחזור מלא או חלקי אם היבוא נכשל."]
              ].map(([step, title, text]) => <article className="procedure-card card" key={step}><StatusBadge>{step}</StatusBadge><div><strong>{title}</strong><span>{text}</span></div></article>)}
            </div>
          </CleanSection>

          <CleanSection title="איכות נתונים" subtitle="שלמות, כפילויות וקשרים.">
            {quality.length ? <div className="stack-list">{quality.slice(0, 6).map((item) => <article className="list-item" key={item.id}><div><strong>{item.gardens?.name ?? item.scope_type}</strong><span>שלמות {item.completeness_score}% · כפילויות {item.duplicate_records_count}</span><small>{item.missing_data_count} חסרים · {item.invalid_records_count} לא תקינים</small></div><StatusBadge tone={item.overall_score >= 80 ? "good" : item.overall_score >= 55 ? "warn" : "bad"}>{item.overall_score}/100</StatusBadge></article>)}</div> : <EmptyState title="אין מדדי איכות עדיין" text="מדדי איכות נוצרים אחרי ולידציה או יבוא." />}
          </CleanSection>

          <CleanSection title="Rollback והיסטוריה" subtitle="שחזור מלא, חלקי או התאוששות מכשל.">
            {rollbacks.length ? <div className="stack-list">{rollbacks.slice(0, 6).map((rollback) => <article className="list-item" key={rollback.id}><div><strong>{rollback.data_migration_batches?.batch_name ?? "יבוא"}</strong><span>{rollback.rollback_type} · {rollback.affected_records} רשומות</span><small>{rollback.reason ?? dateText(rollback.created_at)}</small></div><StatusBadge tone={toneForStatus(rollback.status)}>{statusLabel(rollback.status)}</StatusBadge></article>)}</div> : <EmptyState title="אין פעולות שחזור" text="Rollback יתועד כאן אם יבוא נכשל או אם אדמין מבקש שחזור." />}
          </CleanSection>
        </section>

        <section className="grid cols-3 action-grid">
          <ActionCard title="בדיקת כפילויות" text="ילדים, הורים וצוות" href="/dashboard/admin/duplicates" icon={AlertTriangle} tone="warn" />
          <ActionCard title="מרכז מסמכים" text="קבצים וראיות" href="/dashboard/admin/document-center" icon={History} />
          <ActionCard title="משימות תיקון" text="השלמת נתונים חסרים" href="/dashboard/tasks" icon={RotateCcw} />
        </section>

        <CleanSection title="עוזר מיגרציה" subtitle="העוזר מציע מיפוי ותיקונים, אבל לא כותב נתונים ללא אישור.">
          <div className="ai-prompt-grid">
            {[
              { text: "איזה שדות חסרים ביבוא האחרון?", icon: AlertTriangle },
              { text: "איזו תבנית מתאימה לקובץ ההורים?", icon: Sparkles },
              { text: "אילו רשומות נראות כפולות?", icon: ArrowLeftRight },
              { text: "מה בטוח לייבא עכשיו?", icon: CheckCircle2 }
            ].map(({ text, icon: PromptIcon }) => <article className="card mini-card" key={text}><PromptIcon size={20} /><strong>{text}</strong><span>הצעה בלבד, אישור אנושי חובה.</span></article>)}
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
