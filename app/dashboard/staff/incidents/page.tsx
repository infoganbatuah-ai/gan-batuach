import { Siren } from "lucide-react";
import { IncidentManager } from "@/components/incident-manager";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
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
    <StaffAppFrame active="more">
      <StaffPageHero eyebrow="דיווח מהיר" title="קרה משהו? מתעדים מיד" text="בחרו ילד, חומרה, טקסט קצר ואם צריך תמונה. המנהלת מקבלת התראה להמשך טיפול." icon={Siren} badge={<StatusChip tone="warning">מתועד</StatusChip>} />
      <StaffSection title="דיווח אירוע">
        <IncidentManager gardenId={gardenId} children={(childrenRes.data ?? []) as any[]} incidents={(incidentsRes.data ?? []) as any[]} initialChildId={params.childId ?? ""} />
      </StaffSection>
    </StaffAppFrame>
  );
}
