import { Siren } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { IncidentManager } from "@/components/incident-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenIncidentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
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
    <DashboardShell role="manager" title="אירועים חריגים">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Incident Management</p><h1>דיווח, תיעוד וטיפול באירועים.</h1><p>פציעה, נפילה, בכי חריג, בעיה רפואית, תלונה, מצלמה או בטיחות, עם ציר טיפול.</p></div><span className="pill bad"><Siren size={15} /> טיפול מתועד</span></div>
      <DashboardFilterChip label={params.status === "open" ? "אירועים שלא טופלו" : null} clearHref="/dashboard/garden/incidents" isEmpty={incidents.length === 0} emptyTitle="אין כרגע אירועים שלא טופלו" emptyText="כל האירועים במסנן הזה סגורים או טופלו." />
      <IncidentManager gardenId={gardenId} children={(childrenRes.data ?? []) as any[]} incidents={incidents} />
    </DashboardShell>
  );
}
