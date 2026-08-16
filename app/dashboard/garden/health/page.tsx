import { AlertTriangle, Baby, FileText, HeartPulse, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
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

export default async function GardenHealthPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, recordsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, hmo, allergies, sensitivities, regular_medications, medical_notes").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name"),
    supabase.from("child_health_records" as any).select("*").eq("garden_id", gardenId)
  ]);
  const children = (childrenRes.data ?? []) as any[];
  const records = (recordsRes.data ?? []) as any[];
  const allergies = children.filter((child) => child.allergies || child.sensitivities);
  const medications = children.filter((child) => child.regular_medications);
  const missing = children.filter((child) => !child.hmo && !child.medical_notes && !child.allergies);

  return (
    <DashboardShell role="manager" title="בריאות ותרופות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="בריאות ותרופות בגן" avatarUrl={(profile as any).profile_image_url ?? null} active="children">
        <TeacherPageTitle icon={HeartPulse} title="בריאות ותרופות" subtitle="מידע רפואי קריטי, מוצג רק למורשים" action={<a className="button primary" href="#health-manager">ניהול מלא</a>} />

        <TeacherStatsGrid>
          <TeacherStatCard title="ילדים פעילים" value={children.length} hint="בגן" icon={Baby} tone="purple" />
          <TeacherStatCard title="אלרגיות/רגישויות" value={allergies.length} hint="דורש תשומת לב" icon={AlertTriangle} tone={allergies.length ? "red" : "green"} />
          <TeacherStatCard title="תרופות קבועות" value={medications.length} hint="מעקב צוות" icon={HeartPulse} tone={medications.length ? "orange" : "blue"} />
          <TeacherStatCard title="רשומות" value={records.length} hint="אישורים ועדכונים" icon={FileText} tone="green" />
        </TeacherStatsGrid>

        <TeacherSection title="ילדים שדורשים תשומת לב" action={<a href="#health-manager">לכל הרשומות ›</a>}>
          {allergies.length || medications.length ? (
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

        {missing.length ? (
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
            <HealthMedicineManager gardenId={gardenId} children={children} records={records} />
          </div>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
