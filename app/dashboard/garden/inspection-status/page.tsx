import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
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

export default async function Page() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const [gardenRes, requiredRes, latestRes, violationsRes] = await Promise.all([
    supabase.from("gardens" as any).select("id, name, safe_status, last_inspection_score, next_inspection_at, inspection_required_status").eq("id", profile.garden_id ?? "").maybeSingle(),
    supabase.from("required_inspections" as any).select("id, due_at, status, countdown_day").eq("garden_id", profile.garden_id ?? "").neq("status", "done").order("due_at").limit(1).maybeSingle(),
    supabase.from("inspections" as any).select("id, completed_at, weighted_score, violation_count, status").eq("garden_id", profile.garden_id ?? "").eq("status", "done").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("violations" as any).select("id, title, severity, status, correction_due_at").eq("garden_id", profile.garden_id ?? "").neq("status", "done").limit(20)
  ]);
  const garden = gardenRes.data as any;
  const required = requiredRes.data as any;
  const latest = latestRes.data as any;
  const violations = (violationsRes.data ?? []) as any[];
  const late = required?.due_at ? new Date(required.due_at).getTime() < Date.now() : false;
  const nextInspection = required?.due_at ? new Date(required.due_at).toLocaleDateString("he-IL") : garden?.next_inspection_at ? new Date(garden.next_inspection_at).toLocaleDateString("he-IL") : "טרם";
  const statusLabel = late ? "פיקוח באיחור" : garden?.safe_status === "safe" ? "תקין" : "במעקב";

  return (
    <DashboardShell role="manager" title="סטטוס פיקוח" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מאיה"}`} subtitle={garden?.name ?? "סטטוס פיקוח גן"} avatarUrl={(profile as any).avatar_url ?? null} active="more">
        <TeacherPageTitle icon={ShieldCheck} title="מצב הפיקוח" subtitle="תמונה נקייה של הפיקוח, הציון והפעולות הנדרשות" />

        <TeacherStatsGrid>
          <TeacherStatCard title="פיקוח הבא" value={nextInspection} hint={late ? "באיחור" : "מתוכנן"} icon={CalendarCheck} tone={late ? "red" : "blue"} />
          <TeacherStatCard title="ציון אחרון" value={latest?.weighted_score ?? garden?.last_inspection_score ?? "-"} hint="דוח מאושר" icon={ShieldCheck} tone="green" />
          <TeacherStatCard title="ליקויים פתוחים" value={violations.length} hint="לתיקון" icon={AlertTriangle} tone={violations.length ? "orange" : "green"} />
          <TeacherStatCard title="סטטוס" value={statusLabel} hint={required?.status ?? garden?.inspection_required_status ?? "מעקב"} icon={ClipboardCheck} tone={late ? "red" : "purple"} />
        </TeacherStatsGrid>

        <section className="teacher-dashboard-grid">
          <TeacherSection title="דוח אחרון">
            {latest ? (
              <TeacherCompactList>
                <TeacherCompactItem
                  title={`ציון ${latest.weighted_score ?? "-"}`}
                  subtitle={`${latest.completed_at ? new Date(latest.completed_at).toLocaleString("he-IL") : "תאריך חסר"} · ליקויים ${latest.violation_count ?? 0}`}
                  tone={Number(latest.violation_count ?? 0) ? "orange" : "green"}
                  meta={<Link href={`/dashboard/garden/inspections/${latest.id}/report`}>פתיחת דוח</Link>}
                />
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="עדיין אין ביקורת מאושרת" text="לאחר ביקורת ראשונה של פקח יופיע כאן דוח מלא." />
            )}
          </TeacherSection>

          <TeacherSection title="פעולות נדרשות">
            {violations.length ? (
              <TeacherCompactList>
                {violations.map((row) => (
                  <TeacherCompactItem
                    key={row.id}
                    title={row.title}
                    subtitle={`${row.severity ?? "חומרה"} · יעד ${row.correction_due_at ? new Date(row.correction_due_at).toLocaleDateString("he-IL") : "לא הוגדר"}`}
                    tone={row.severity === "critical" || row.severity === "high" ? "red" : "orange"}
                    meta={row.status}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="אין ליקויים פתוחים" text="כל הפעולות הנדרשות סגורות כרגע." />
            )}
          </TeacherSection>
        </section>

        <TeacherAiInsight>
          {late ? "הפיקוח באיחור. מומלץ לתאם מועד ולעדכן את האדמין." : violations.length ? "יש פעולות תיקון פתוחות. התחילי בפריטים עם יעד קרוב." : "הגן נראה מוכן לפיקוח הבא. שמרי מסמכים ותיעוד במקום אחד."}
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות פיקוח">
          <TeacherActionTile title="כל הדוחות" href="/dashboard/garden/inspections" icon={FileText} tone="blue" />
          <TeacherActionTile title="מסמכי פיקוח" href="/dashboard/garden/documents" icon={ShieldCheck} tone="green" />
          <TeacherActionTile title="מרכז הגן" href="/dashboard/garden" icon={ClipboardCheck} tone="purple" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
