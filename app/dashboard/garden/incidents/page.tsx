import { AlertTriangle, CheckCircle2, FileText, Siren } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { IncidentManager } from "@/components/incident-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
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

export default async function GardenIncidentsPage({ searchParams }: { searchParams: Promise<{ status?: string; new?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, incidentsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url").eq("garden_id", gardenId).order("full_name"),
    supabase.from("incident_reports" as any).select("*, children(full_name, photo_url)").eq("garden_id", gardenId).neq("status", "closed").order("created_at", { ascending: false }).limit(60)
  ]);
  const incidents = ((incidentsRes.data ?? []) as any[]).filter((incident) => {
    if (params.status === "open") return !["closed", "resolved", "done", "handled"].includes(incident.status);
    return true;
  });
  return (
    <DashboardShell role="manager" title="אירועים חריגים" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מאיה"}`} subtitle="דיווחים גננת" avatarUrl={(profile as any).avatar_url ?? null} active="more">
      <TeacherPageTitle icon={Siren} title="דיווחים גננת" subtitle="תיעוד, טיפול ומעקב אירועים" />
      <TeacherStatsGrid>
        <TeacherStatCard title="פתוחים" value={incidents.length} hint="לטיפול" icon={AlertTriangle} tone={incidents.length ? "red" : "green"} />
        <TeacherStatCard title="ילדים בגן" value={(childrenRes.data ?? []).length} hint="לשיוך דיווח" icon={FileText} tone="blue" />
        <TeacherStatCard title="טופלו" value="0" hint="היום" icon={CheckCircle2} tone="green" />
        <TeacherStatCard title="דחיפות" value={incidents.filter((incident) => ["critical", "high", "urgent"].includes(String(incident.severity))).length} hint="גבוהה" icon={Siren} tone="orange" />
      </TeacherStatsGrid>
      <DashboardFilterChip label={params.status === "open" ? "אירועים שלא טופלו" : null} clearHref="/dashboard/garden/incidents" isEmpty={incidents.length === 0} emptyTitle="אין כרגע אירועים שלא טופלו" emptyText="כל האירועים במסנן הזה סגורים או טופלו." />
      <TeacherSection title="דיווחים אחרונים" action={<a href="/dashboard/garden/incidents?status=open">פתוחים</a>}>
        {incidents.length ? (
          <TeacherCompactList>
            {incidents.slice(0, 8).map((incident) => (
              <TeacherCompactItem key={incident.id} title={incident.title ?? incident.incident_type ?? "אירוע"} subtitle={`${incident.children?.full_name ?? "ללא שיוך ילד"} · ${incident.created_at ? new Date(incident.created_at).toLocaleString("he-IL") : ""}`} tone={["critical", "high", "urgent"].includes(String(incident.severity)) ? "red" : "orange"} meta={incident.status ?? "פתוח"} />
            ))}
          </TeacherCompactList>
        ) : <TeacherEmptyState title="אין אירועים פתוחים" text="כשתפתחי דיווח חדש הוא יופיע כאן בצורה ברורה ומהירה." />}
      </TeacherSection>
      <TeacherQuickActions title="פעולות דיווח">
        <TeacherActionTile title="דיווח חדש" href="/dashboard/garden/incidents?new=1#incident-workbench" icon={Siren} tone="red" />
        <TeacherActionTile title="דוחות" href="/dashboard/garden/inspections" icon={FileText} tone="blue" />
      </TeacherQuickActions>
      <details className="teacher-management-details" id="incident-workbench" open={params.new === "1"}>
        <summary>ניהול דיווחים מלא</summary>
      <IncidentManager gardenId={gardenId} children={(childrenRes.data ?? []) as any[]} incidents={incidents} defaultOpen={params.new === "1"} />
      </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
