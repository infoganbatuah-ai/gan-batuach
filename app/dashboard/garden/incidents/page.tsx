import { Siren } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { IncidentManager } from "@/components/incident-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenIncidentsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, incidentsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url").eq("garden_id", gardenId).order("full_name"),
    supabase.from("incident_reports" as any).select("*, children(full_name, photo_url)").eq("garden_id", gardenId).neq("status", "closed").order("created_at", { ascending: false }).limit(60)
  ]);
  return (
    <DashboardShell role="manager" title="אירועים חריגים">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Incident Management</p><h1>דיווח, תיעוד וטיפול באירועים.</h1><p>פציעה, נפילה, בכי חריג, בעיה רפואית, תלונה, מצלמה או בטיחות, עם ציר טיפול.</p></div><span className="pill bad"><Siren size={15} /> טיפול מתועד</span></div>
      <IncidentManager gardenId={gardenId} children={(childrenRes.data ?? []) as any[]} incidents={(incidentsRes.data ?? []) as any[]} />
    </DashboardShell>
  );
}
