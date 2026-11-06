import Link from "next/link";
import { AlertTriangle, BookOpenCheck, ClipboardCheck, FileText, ShieldCheck, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildComplianceScore, complianceTone, expirationBucket } from "@/lib/domain/smart-compliance";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

type ComplianceDocument = { id: string; name: string; document_type: string; status: string; expires_at: string | null };
type ComplianceStaff = { approved_to_work: boolean; background_check_status: string; police_clearance_status: string };
type ComplianceAlert = { id: string; title: string; expiration_date: string | null; category: string; severity: string };
type ComplianceAction = { id: string; action_title: string; due_at: string | null; priority: string; status: string };
type ComplianceRow = { id: string };

async function complianceQuery(label: string, query: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query();
    logSupabaseError(label, result.error);
    return result.error ? { data: null, error: true } : { data: result.data, error: false };
  } catch {
    logSupabaseError(label, true);
    return { data: null, error: true };
  }
}

export default async function GardenCompliancePage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) {
    return <DashboardShell role="manager" title="ציות הגן" appHome><AdminDataError message="לא ניתן לטעון נתוני ציות ללא שיוך לגן" /></DashboardShell>;
  }
  const result = await safeAdminData("garden compliance", async () => {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const ninetyDays = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const [documentsRes, staffRes, alertsRes, actionsRes, findingsRes, inspectionsRes] = await Promise.all([
      complianceQuery("garden compliance documents", () => supabase.from("documents" as any).select("id,name,document_type,status,expires_at").eq("garden_id", gardenId).order("expires_at", { ascending: true }).limit(120)),
      complianceQuery("garden compliance staff", () => supabase.from("staff" as any).select("id,full_name,background_check_status,police_clearance_status,approved_to_work").eq("garden_id", gardenId).limit(160)),
      complianceQuery("garden compliance alerts", () => supabase.from("compliance_alerts" as any).select("*").eq("garden_id", gardenId).in("alert_status", ["open", "in_progress"]).order("expiration_date", { ascending: true }).limit(80)),
      complianceQuery("garden compliance actions", () => supabase.from("compliance_corrective_actions" as any).select("*").eq("garden_id", gardenId).not("status", "in", "(verified,closed,cancelled)").order("due_at", { ascending: true }).limit(80)),
      complianceQuery("garden compliance findings", () => supabase.from("national_compliance_findings" as any).select("*").eq("garden_id", gardenId).in("resolution_status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(80)),
      complianceQuery("garden compliance inspections", () => supabase.from("required_inspections" as any).select("*").eq("garden_id", gardenId).lt("due_at", nowIso).neq("status", "done").limit(20))
    ]);
    const available = [documentsRes, staffRes, alertsRes, actionsRes, findingsRes, inspectionsRes].map((res) => !res.error);
    const documents = (documentsRes.data ?? []) as ComplianceDocument[];
    const staff = (staffRes.data ?? []) as ComplianceStaff[];
    const alerts = (alertsRes.data ?? []) as ComplianceAlert[];
    const actions = (actionsRes.data ?? []) as ComplianceAction[];
    const findings = (findingsRes.data ?? []) as ComplianceRow[];
    const overdueInspections = (inspectionsRes.data ?? []) as ComplianceRow[];
    const score = [0, 1, 2, 4, 5].every((index) => available[index]) ? buildComplianceScore({
      totalDocuments: documents.length,
      invalidDocuments: documents.filter((doc) => ["missing", "required", "expired", "rejected"].includes(String(doc.status))).length,
      expiringDocuments: documents.filter((doc) => doc.expires_at && doc.expires_at <= ninetyDays).length,
      totalStaff: staff.length,
      staffIssues: staff.filter((member) => !member.approved_to_work || member.background_check_status !== "valid" || member.police_clearance_status !== "valid").length,
      overdueInspections: overdueInspections.length,
      unresolvedFindings: findings.length + alerts.length,
      missingProcedures: 0,
      policyGaps: 0
    }) : null;
    return { documents, staff, alerts, actions, findings, overdueInspections, score, available, queryError: available.some((value) => !value) ? "חלק מנתוני הציות לא נטענו" : null };
  }, { documents: [] as ComplianceDocument[], staff: [] as ComplianceStaff[], alerts: [] as ComplianceAlert[], actions: [] as ComplianceAction[], findings: [] as ComplianceRow[], overdueInspections: [] as ComplianceRow[], score: null as ReturnType<typeof buildComplianceScore> | null, available: [false, false, false, false, false, false], queryError: null as string | null });
  const data = result.data;
  return (
    <DashboardShell role="manager" title="ציות הגן" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="מוכנות ציות ופיקוח" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={ShieldCheck} title="מוכנות ציות של הגן" subtitle="מה חסר, מה עומד לפוג ומה צריך תיקון כדי להישאר מוכנים לפיקוח" action={<Link className="button primary" href="/dashboard/garden/documents">מסמכים</Link>} />
        <AdminDataError message={result.error ?? data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="ציון" value={data.score ? `${data.score.score}/100` : "לא זמין"} hint="מוכנות" icon={ShieldCheck} tone={!data.score ? "neutral" : data.score.tone === "bad" ? "red" : data.score.tone === "warn" ? "orange" : "green"} />
          <TeacherStatCard title="התראות" value={data.available[2] ? data.alerts.length : "לא זמין"} hint="פתוחות" icon={AlertTriangle} tone={!data.available[2] ? "neutral" : data.alerts.length ? "orange" : "green"} />
          <TeacherStatCard title="פעולות" value={data.available[3] ? data.actions.length : "לא זמין"} hint="תיקון" icon={BookOpenCheck} tone={!data.available[3] ? "neutral" : data.actions.length ? "purple" : "green"} />
          <TeacherStatCard title="פיקוח באיחור" value={data.available[5] ? data.overdueInspections.length : "לא זמין"} hint="דורש טיפול" icon={ClipboardCheck} tone={!data.available[5] ? "neutral" : data.overdueInspections.length ? "red" : "green"} />
        </TeacherStatsGrid>

        <section className="teacher-children-layout">
          <TeacherSection title="מה דורש טיפול">
            {!data.available[2] ? <TeacherEmptyState title="ההתראות לא זמינות" text="לא ניתן לטעון את ההתראות כרגע." /> : data.alerts.length === 0 ? <TeacherEmptyState title="אין התראות פתוחות" text="אין התראות פתוחות ברשימת ההתראות." /> : (
              <TeacherCompactList>
                {data.alerts.slice(0, 8).map((alert) => (
                  <TeacherCompactItem key={alert.id} title={alert.title} subtitle={alert.expiration_date ? new Date(alert.expiration_date).toLocaleDateString("he-IL") : alert.category} tone={complianceTone(alert.severity) === "bad" ? "red" : "orange"} meta={alert.severity} />
                ))}
              </TeacherCompactList>
            )}
          </TeacherSection>

          <TeacherSection title="פעולות תיקון">
            {!data.available[3] ? <TeacherEmptyState title="פעולות התיקון לא זמינות" text="לא ניתן לטעון פעולות תיקון כרגע." /> : data.actions.length === 0 ? <TeacherEmptyState title="אין פעולות תיקון" text="פעולות תיקון יופיעו כאן לאחר פיקוח או התראת ציות." /> : (
              <TeacherCompactList>
                {data.actions.slice(0, 8).map((action) => (
                  <TeacherCompactItem key={action.id} title={action.action_title} subtitle={action.due_at ? new Date(action.due_at).toLocaleDateString("he-IL") : "ללא תאריך"} tone={complianceTone(action.priority) === "bad" ? "red" : "purple"} meta={action.status} />
                ))}
              </TeacherCompactList>
            )}
          </TeacherSection>
        </section>

        <TeacherSection title="מסמכים ותוקף" action={<Link href="/dashboard/garden/documents">ניהול מסמכים ›</Link>}>
          {!data.available[0] ? <TeacherEmptyState title="המסמכים לא זמינים" text="לא ניתן לטעון מסמכים כרגע." /> : data.documents.length === 0 ? <TeacherEmptyState title="אין מסמכים להצגה" text="מסמכים שיועלו לגן יופיעו כאן לפי תוקף וסטטוס." /> : (
            <TeacherCompactList>
              {data.documents.slice(0, 8).map((doc) => (
                <TeacherCompactItem key={doc.id} title={doc.name} subtitle={`${doc.document_type} · ${doc.expires_at ? new Date(doc.expires_at).toLocaleDateString("he-IL") : "ללא תוקף"}`} tone={complianceTone(expirationBucket(doc.expires_at)) === "bad" ? "red" : "blue"} meta={doc.status} href="/dashboard/garden/documents" />
              ))}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherAiInsight metric={data.score ? `${data.score.score}/100` : "לא זמין"}>
          המסך מציג readiness בלבד. פעולות תיקון ומסמכים נשארים במסכים המורשים ואינם נחשפים לציבור.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות ציות">
          <TeacherActionTile title="מסמכים" href="/dashboard/garden/documents" icon={FileText} tone="purple" />
          <TeacherActionTile title="צוות" href="/dashboard/garden/staff" icon={UserCheck} tone="blue" />
          <TeacherActionTile title="פיקוחים" href="/dashboard/garden/inspections" icon={ClipboardCheck} tone="green" />
          <TeacherActionTile title="נהלים" href="/dashboard/garden/tasks" icon={BookOpenCheck} tone="orange" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
