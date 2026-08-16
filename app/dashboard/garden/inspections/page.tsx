import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AlertTriangle, CalendarCheck, ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
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

export default async function GardenInspectionsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const [gardenRes, inspectionsRes, violationsRes] = await Promise.all([
    supabase.from("gardens" as any).select("id, next_inspection_at, last_inspection_score, inspection_required_status, safe_status").eq("id", profile.garden_id ?? "").maybeSingle(),
    supabase.from("inspections" as any).select("id, completed_at, status, weighted_score, violation_count, inspectors:inspector_id(full_name)").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false }).limit(50),
    supabase.from("violations" as any).select("id, title, status, severity, due_at").eq("garden_id", profile.garden_id ?? "").neq("status", "done").limit(50)
  ]);
  const garden = gardenRes.data as any;
  const dueSoon = Boolean(garden?.next_inspection_at && Math.ceil((new Date(garden.next_inspection_at).getTime() - Date.now()) / 86400000) <= 5);
  const showDueOnly = params.filter === "due-soon";
  const inspections = (inspectionsRes.data ?? []) as any[];
  const violations = (violationsRes.data ?? []) as any[];
  const nextInspection = garden?.next_inspection_at ? new Date(garden.next_inspection_at).toLocaleDateString("he-IL") : "טרם";

  return (
    <DashboardShell role="manager" title="פיקוח" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="פיקוח ובטיחות גן" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={ShieldCheck} title="פיקוחים ודוחות" subtitle="ביקורת חודשית, ציון אחרון וליקויים לתיקון" />
        <DashboardFilterChip label={showDueOnly ? "פיקוח קרוב" : null} clearHref="/dashboard/garden/inspections" isEmpty={showDueOnly && !dueSoon} emptyTitle="אין כרגע פיקוח קרוב" emptyText="לא נמצא מועד פיקוח בטווח הקרוב לגן הזה." />

        <TeacherStatsGrid>
          <TeacherStatCard title="ציון אחרון" value={garden?.last_inspection_score ?? "-"} hint="בטיחות" icon={ShieldCheck} tone={garden?.safe_status === "safe" ? "green" : "orange"} />
          <TeacherStatCard title="ביקורת הבאה" value={nextInspection} hint={dueSoon ? "קרוב" : "מתוכנן"} icon={CalendarCheck} tone={dueSoon ? "orange" : "blue"} href="/dashboard/garden/inspections?filter=due-soon" />
          <TeacherStatCard title="ליקויים פתוחים" value={violations.length} hint="לתיקון" icon={AlertTriangle} tone={violations.length ? "red" : "green"} />
          <TeacherStatCard title="דוחות" value={inspections.length} hint="היסטוריה" icon={FileText} tone="purple" />
        </TeacherStatsGrid>

        <section className="teacher-dashboard-grid">
          <TeacherSection title={showDueOnly ? "פיקוח קרוב" : "היסטוריית ביקורות"}>
            {showDueOnly && !dueSoon ? (
              <TeacherEmptyState title="אין כרגע פיקוח קרוב" text="כאשר מועד הפיקוח יתקרב, הוא יופיע כאן." />
            ) : inspections.length ? (
              <TeacherCompactList>
                {inspections.slice(0, 6).map((inspection: any) => (
                  <TeacherCompactItem
                    key={inspection.id}
                    title={`ציון ${inspection.weighted_score ?? "-"}`}
                    subtitle={`${inspection.inspectors?.full_name ?? "פקח"} · ${inspection.completed_at ? new Date(inspection.completed_at).toLocaleString("he-IL") : inspection.status}`}
                    tone={Number(inspection.violation_count ?? 0) ? "orange" : "green"}
                    meta={<Link href={`/dashboard/garden/inspections/${inspection.id}/report`}>דוח</Link>}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="אין ביקורות עדיין" text="לאחר ביקורת פקח, הדוח והציון יופיעו כאן." />
            )}
          </TeacherSection>

          <TeacherSection title="ליקויים ותיקונים" subtitle="משימות שממתינות לטיפול">
            {violations.length ? (
              <TeacherCompactList>
                {violations.slice(0, 6).map((violation: any) => (
                  <TeacherCompactItem
                    key={violation.id}
                    title={violation.title}
                    subtitle={`${violation.severity ?? "חומרה"} · ${violation.due_at ? new Date(violation.due_at).toLocaleDateString("he-IL") : "ללא יעד"}`}
                    tone={violation.severity === "critical" || violation.severity === "high" ? "red" : "orange"}
                    meta={violation.status ?? "פתוח"}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="אין ליקויים פתוחים" text="שאלות בציון נמוך או כשל קריטי יופיעו כאן עם משימת תיקון." />
            )}
          </TeacherSection>
        </section>

        <TeacherAiInsight>
          {violations.length ? "יש ליקויים פתוחים. מומלץ לטפל קודם בפריטים עם חומרה גבוהה או תאריך יעד קרוב." : "אין ליקויים פתוחים כרגע. המשיכי לשמור על תיעוד מסודר לקראת הפיקוח הבא."}
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות פיקוח">
          <TeacherActionTile title="סטטוס פיקוח" href="/dashboard/garden/inspection-status" icon={ClipboardCheck} tone="purple" />
          <TeacherActionTile title="דוחות" href="/dashboard/garden/inspections" icon={FileText} tone="blue" />
          <TeacherActionTile title="מסמכים" href="/dashboard/garden/documents" icon={ShieldCheck} tone="green" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
