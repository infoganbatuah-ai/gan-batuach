import { HeartPulse } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { HealthMedicineManager } from "@/components/health-medicine-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenHealthPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, recordsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, hmo, allergies, sensitivities, regular_medications, medical_notes").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name"),
    supabase.from("child_health_records" as any).select("*").eq("garden_id", gardenId)
  ]);
  return (
    <DashboardShell role="manager" title="בריאות ותרופות">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Health & Medicine</p><h1>מידע רפואי קריטי בלי בלגן.</h1><p>אלרגיות, רגישויות, תרופות, אישורי הורים, אנשי קשר חירום והתראות חסר.</p></div><span className="pill warn"><HeartPulse size={15} /> מידע רגיש לפי הרשאה</span></div>
      <HealthMedicineManager gardenId={gardenId} children={(childrenRes.data ?? []) as any[]} records={(recordsRes.data ?? []) as any[]} />
    </DashboardShell>
  );
}
