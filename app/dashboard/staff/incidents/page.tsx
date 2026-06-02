import { Siren } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { IncidentManager } from "@/components/incident-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffIncidentsPage({ searchParams }: { searchParams?: Promise<{ childId?: string }> }) {
  const params: { childId?: string } = searchParams ? await searchParams.catch(() => ({})) : {};
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, incidentsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name"),
    supabase.from("incident_reports" as any).select("*, children(full_name, photo_url)").eq("garden_id", gardenId).neq("status", "closed").order("created_at", { ascending: false }).limit(60)
  ]);

  return (
    <DashboardShell role="staff" title="דיווח אירוע">
      <div className="dashboard-hero-card staff-hero-card">
        <div>
          <p className="eyebrow">Incident Report</p>
          <h1>דיווח אירוע מהיר לצוות.</h1>
          <p>תיעוד אירוע, ילד קשור, חומרה ותמונה. המנהלת מקבלת התראה להמשך טיפול.</p>
        </div>
        <span className="pill warn"><Siren size={15} /> מתועד</span>
      </div>
      <IncidentManager gardenId={gardenId} children={(childrenRes.data ?? []) as any[]} incidents={(incidentsRes.data ?? []) as any[]} initialChildId={params.childId ?? ""} />
    </DashboardShell>
  );
}
