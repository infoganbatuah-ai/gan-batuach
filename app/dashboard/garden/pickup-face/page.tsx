import { ScanFace } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { FaceMatchReviewPanel } from "@/components/face-match-review-panel";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenPickupFacePage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [contacts, results] = await Promise.all([
    supabase.from("authorized_pickup_contacts" as any).select("id, full_name, relation, child_id, children(full_name)").eq("kindergarten_id", gardenId).eq("active", true).order("full_name").limit(300),
    supabase.from("face_match_results" as any).select("*, authorized_pickup_contacts(full_name, relation), children(full_name)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(120)
  ]);

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="Face Match Review">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">Pickup verification readiness</p>
          <h1>בדיקת התאמה אפשרית באיסוף.</h1>
          <p>תשתית mock בלבד להשוואת פנים עתידית. אין החלטה ביומטרית, אין שחרור אוטומטי, ואין הצגת ציונים להורים.</p>
        </div>
        <span className="pill warn"><ScanFace size={15} /> Human confirmation required</span>
      </div>
      <FaceMatchReviewPanel contacts={(contacts.data ?? []) as any[]} results={(results.data ?? []) as any[]} />
    </DashboardShell>
  );
}
