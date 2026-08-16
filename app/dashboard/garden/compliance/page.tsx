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

export default async function GardenCompliancePage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden compliance", async () => {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const ninetyDays = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const [documentsRes, staffRes, alertsRes, actionsRes, findingsRes, inspectionsRes] = await Promise.all([
      supabase.from("documents" as any).select("id,name,document_type,status,expires_at").eq("garden_id", gardenId).order("expires_at", { ascending: true }).limit(120),
      supabase.from("staff" as any).select("id,full_name,background_check_status,police_clearance_status,approved_to_work").eq("garden_id", gardenId).limit(160),
      supabase.from("compliance_alerts" as any).select("*").eq("garden_id", gardenId).in("alert_status", ["open", "in_progress"]).order("expiration_date", { ascending: true }).limit(80),
      supabase.from("compliance_corrective_actions" as any).select("*").eq("garden_id", gardenId).not("status", "in", "(verified,closed,cancelled)").order("due_at", { ascending: true }).limit(80),
      supabase.from("national_compliance_findings" as any).select("*").eq("garden_id", gardenId).in("resolution_status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(80),
      supabase.from("required_inspections" as any).select("*").eq("garden_id", gardenId).lt("due_at", nowIso).neq("status", "done").limit(20)
    ]);
    [documentsRes, staffRes, alertsRes, actionsRes, findingsRes, inspectionsRes].forEach((res, index) => logSupabaseError(`garden compliance ${index}`, (res as any).error));
    const documents = (documentsRes.data ?? []) as any[];
    const staff = (staffRes.data ?? []) as any[];
    const alerts = (alertsRes.data ?? []) as any[];
    const actions = (actionsRes.data ?? []) as any[];
    const findings = (findingsRes.data ?? []) as any[];
    const overdueInspections = (inspectionsRes.data ?? []) as any[];
    const score = buildComplianceScore({
      totalDocuments: documents.length,
      invalidDocuments: documents.filter((doc) => ["missing", "required", "expired", "rejected"].includes(String(doc.status))).length,
      expiringDocuments: documents.filter((doc) => doc.expires_at && doc.expires_at <= ninetyDays).length,
      totalStaff: staff.length,
      staffIssues: staff.filter((member) => !member.approved_to_work || member.background_check_status !== "valid" || member.police_clearance_status !== "valid").length,
      overdueInspections: overdueInspections.length,
      unresolvedFindings: findings.length + alerts.length,
      missingProcedures: 0,
      policyGaps: 0
    });
    return { documents, staff, alerts, actions, findings, overdueInspections, score, queryError: [documentsRes.error, staffRes.error].some(Boolean) ? "חלק מנתוני הציות לא נטענו" : null };
  }, { documents: [] as any[], staff: [] as any[], alerts: [] as any[], actions: [] as any[], findings: [] as any[], overdueInspections: [] as any[], score: buildComplianceScore({ totalDocuments: 0, invalidDocuments: 0, expiringDocuments: 0, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: 0, missingProcedures: 0, policyGaps: 0 }), queryError: null as string | null });
  const data = result.data;
  return (
    <DashboardShell role="manager" title="ציות הגן" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="מוכנות ציות ופיקוח" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={ShieldCheck} title="מוכנות ציות של הגן" subtitle="מה חסר, מה עומד לפוג ומה צריך תיקון כדי להישאר מוכנים לפיקוח" action={<Link className="button primary" href="/dashboard/garden/documents">מסמכים</Link>} />
        <AdminDataError message={result.error ?? data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="ציון" value={`${data.score.score}/100`} hint="מוכנות" icon={ShieldCheck} tone={data.score.tone === "bad" ? "red" : data.score.tone === "warn" ? "orange" : "green"} />
          <TeacherStatCard title="התראות" value={data.alerts.length} hint="פתוחות" icon={AlertTriangle} tone={data.alerts.length ? "orange" : "green"} />
          <TeacherStatCard title="פעולות" value={data.actions.length} hint="תיקון" icon={BookOpenCheck} tone={data.actions.length ? "purple" : "green"} />
          <TeacherStatCard title="פיקוח באיחור" value={data.overdueInspections.length} hint="דורש טיפול" icon={ClipboardCheck} tone={data.overdueInspections.length ? "red" : "green"} />
        </TeacherStatsGrid>

        <section className="teacher-children-layout">
          <TeacherSection title="מה דורש טיפול">
            {data.alerts.length === 0 ? <TeacherEmptyState title="אין התראות פתוחות" text="מסמכים, צוות ופיקוח נראים תקינים כרגע." /> : (
              <TeacherCompactList>
                {data.alerts.slice(0, 8).map((alert: any) => (
                  <TeacherCompactItem key={alert.id} title={alert.title} subtitle={alert.expiration_date ? new Date(alert.expiration_date).toLocaleDateString("he-IL") : alert.category} tone={complianceTone(alert.severity) === "bad" ? "red" : "orange"} meta={alert.severity} />
                ))}
              </TeacherCompactList>
            )}
          </TeacherSection>

          <TeacherSection title="פעולות תיקון">
            {data.actions.length === 0 ? <TeacherEmptyState title="אין פעולות תיקון" text="פעולות תיקון יופיעו כאן לאחר פיקוח או התראת ציות." /> : (
              <TeacherCompactList>
                {data.actions.slice(0, 8).map((action: any) => (
                  <TeacherCompactItem key={action.id} title={action.action_title} subtitle={action.due_at ? new Date(action.due_at).toLocaleDateString("he-IL") : "ללא תאריך"} tone={complianceTone(action.priority) === "bad" ? "red" : "purple"} meta={action.status} />
                ))}
              </TeacherCompactList>
            )}
          </TeacherSection>
        </section>

        <TeacherSection title="מסמכים ותוקף" action={<Link href="/dashboard/garden/documents">ניהול מסמכים ›</Link>}>
          {data.documents.length === 0 ? <TeacherEmptyState title="אין מסמכים להצגה" text="מסמכים שיועלו לגן יופיעו כאן לפי תוקף וסטטוס." /> : (
            <TeacherCompactList>
              {data.documents.slice(0, 8).map((doc: any) => (
                <TeacherCompactItem key={doc.id} title={doc.name} subtitle={`${doc.document_type} · ${doc.expires_at ? new Date(doc.expires_at).toLocaleDateString("he-IL") : "ללא תוקף"}`} tone={complianceTone(expirationBucket(doc.expires_at)) === "bad" ? "red" : "blue"} meta={doc.status} href="/dashboard/garden/documents" />
              ))}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherAiInsight metric={`${data.score.score}/100`}>
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
