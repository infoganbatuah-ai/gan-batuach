import { AlertTriangle, Baby, FileText, HeartPulse, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { HealthMedicineManager } from "@/components/health-medicine-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

type HealthChild = { id: string; full_name: string; photo_url?: string | null; hmo?: string | null; allergies?: string | null; sensitivities?: string | null; regular_medications?: string | null; medical_notes?: string | null };
type HealthManagerProps = Parameters<typeof HealthMedicineManager>[0];

async function healthQuery(label: string, query: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query();
    logSupabaseError(label, result.error);
    return result.error ? { data: null, error: true } : { data: result.data, error: false };
  } catch {
    logSupabaseError(label, true);
    return { data: null, error: true };
  }
}

export default async function GardenHealthPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) {
    return <DashboardShell role="manager" title="בריאות ותרופות" appHome><AdminDataError message="לא ניתן לטעון נתוני בריאות ללא שיוך לגן" /></DashboardShell>;
  }
  const result = await safeAdminData("garden health", async () => {
    const supabase = await createClient();
    const [childrenRes, recordsRes] = await Promise.all([
      healthQuery("garden health children", () => supabase.from("children" as any).select("id, full_name, photo_url, hmo, allergies, sensitivities, regular_medications, medical_notes").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name")),
      healthQuery("garden health records", () => supabase.from("child_health_records" as any).select("*").eq("garden_id", gardenId))
    ]);
    const available = [!childrenRes.error, !recordsRes.error];
    return { children: (childrenRes.data ?? []) as HealthChild[], records: (recordsRes.data ?? []) as HealthManagerProps["records"], available, queryError: available.some((value) => !value) ? "חלק מנתוני הבריאות לא נטענו" : null };
  }, { children: [] as HealthChild[], records: [] as HealthManagerProps["records"], available: [false, false], queryError: null as string | null });
  const { children, records, available } = result.data;
  const allergies = children.filter((child) => child.allergies || child.sensitivities);
  const medications = children.filter((child) => child.regular_medications);
  const missing = children.filter((child) => !child.hmo && !child.medical_notes && !child.allergies);

  return (
    <DashboardShell role="manager" title="בריאות ותרופות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="בריאות ותרופות בגן" avatarUrl={(profile as any).profile_image_url ?? null} active="children">
        <TeacherPageTitle icon={HeartPulse} title="בריאות ותרופות" subtitle="מידע רפואי קריטי, מוצג רק למורשים" action={<a className="button primary" href="#health-manager">ניהול מלא</a>} />
        <AdminDataError message={result.error ?? result.data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="ילדים פעילים" value={available[0] ? children.length : "לא זמין"} hint="בגן" icon={Baby} tone={available[0] ? "purple" : "neutral"} />
          <TeacherStatCard title="אלרגיות/רגישויות" value={available[0] ? allergies.length : "לא זמין"} hint="דורש תשומת לב" icon={AlertTriangle} tone={!available[0] ? "neutral" : allergies.length ? "red" : "green"} />
          <TeacherStatCard title="תרופות קבועות" value={available[0] ? medications.length : "לא זמין"} hint="מעקב צוות" icon={HeartPulse} tone={!available[0] ? "neutral" : medications.length ? "orange" : "blue"} />
          <TeacherStatCard title="רשומות" value={available[1] ? records.length : "לא זמין"} hint="אישורים ועדכונים" icon={FileText} tone={available[1] ? "green" : "neutral"} />
        </TeacherStatsGrid>

        <TeacherSection title="ילדים שדורשים תשומת לב" action={<a href="#health-manager">לכל הרשומות ›</a>}>
          {!available[0] ? <TeacherEmptyState title="נתוני תשומת הלב לא זמינים" text="לא ניתן לטעון נתוני בריאות כרגע." /> : allergies.length || medications.length ? (
            <TeacherCompactList>
              {[...allergies, ...medications].slice(0, 6).map((child) => (
                <TeacherCompactItem
                  key={child.id}
                  title={child.full_name}
                  subtitle={`${child.allergies ? `אלרגיות: ${child.allergies}` : "אין אלרגיה רשומה"} · ${child.regular_medications ? "תרופה קבועה" : "ללא תרופה קבועה"}`}
                  tone={child.allergies ? "red" : "orange"}
                  avatar={child.photo_url}
                  meta="בדיקה"
                  href={`/dashboard/garden/children/${child.id}`}
                />
              ))}
            </TeacherCompactList>
          ) : (
            <TeacherEmptyState title="אין התראות רפואיות פתוחות" text="כאשר יופיעו אלרגיות, תרופות או אישורים חסרים, הם יוצגו כאן." />
          )}
        </TeacherSection>

        {!available[0] ? <TeacherSection title="פרטים חסרים"><TeacherEmptyState title="לא ניתן לבדוק פרטים חסרים כרגע" /></TeacherSection> : missing.length ? (
          <TeacherSection title="פרטים חסרים" action={<a href="/dashboard/garden/children">ניהול ילדים ›</a>}>
            <TeacherCompactList>
              {missing.slice(0, 4).map((child) => (
                <TeacherCompactItem key={child.id} title={child.full_name} subtitle="חסר מידע רפואי בסיסי בכרטיס הילד" tone="orange" avatar={child.photo_url} href={`/dashboard/garden/children/${child.id}`} meta="חסר" />
              ))}
            </TeacherCompactList>
          </TeacherSection>
        ) : null}

        <TeacherAiInsight metric="פרטי">
          מידע רפואי נשאר בתוך אזור מורשה בלבד. אין חשיפה ציבורית ואין פתיחת גישה לצוות לא מאושר.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות בריאות">
          <TeacherActionTile title="כרטיסי ילדים" href="/dashboard/garden/children" icon={Baby} tone="purple" />
          <TeacherActionTile title="מסמכים" href="/dashboard/garden/documents" icon={FileText} tone="blue" />
          <TeacherActionTile title="דוח בטיחות" href="/dashboard/garden/reports" icon={ShieldCheck} tone="green" />
        </TeacherQuickActions>

        <details className="teacher-management-details" id="health-manager">
          <summary>ניהול מלא של בריאות ותרופות</summary>
          <div className="teacher-embedded-module">
            {available[0] && available[1] ? <HealthMedicineManager gardenId={gardenId} children={children as HealthManagerProps["children"]} records={records} /> : <TeacherEmptyState title="ניהול הבריאות לא זמין" text="נדרשים נתוני ילדים ורשומות מלאים לפני ניהול ועדכון." />}
          </div>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
