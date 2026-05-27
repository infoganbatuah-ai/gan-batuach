import { Bell, UserRoundPlus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenParentLeadsCenter } from "@/components/garden-parent-leads-center";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenLeadsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const { data } = await supabase
    .from("leads" as any)
    .select("id, garden_id, lead_type, parent_name, phone, email, child_name, child_age, notes, status, source, missing_details, converted_parent_id, converted_child_id, converted_at, created_at, gardens(name, city)")
    .eq("garden_id", gardenId)
    .eq("lead_type", "parent")
    .order("created_at", { ascending: false });

  const leads = (data ?? []) as any[];
  const newCount = leads.filter((lead) => ["new", "new_parent_lead"].includes(lead.status)).length;
  const pendingCompletion = leads.filter((lead) => lead.status === "approved_pending_parent_completion").length;
  const missing = leads.filter((lead) => lead.status === "missing_details").length;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="לידים / בקשות הצטרפות">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">Parent Leads</p>
          <h1>בקשות רישום שמגיעות ישירות מהעמוד הציבורי של הגן.</h1>
          <p>כל בקשה נשמרת, נשלחת כהתראה למנהלת/בעלים, וניתנת להמרה להורה פעיל עם כרטיס ילד להשלמת פרטים.</p>
        </div>
        <span className={newCount ? "pill warn" : "pill good"}><Bell size={15} /> {newCount} חדשים</span>
      </div>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="לידים חדשים" value={newCount} tone={newCount ? "warn" : "good"} />
        <StatCard label="ממתינים להשלמת הורה" value={pendingCompletion} tone={pendingCompletion ? "warn" : "good"} />
        <StatCard label="חסרים פרטים" value={missing} tone={missing ? "bad" : "good"} />
        <StatCard label="סה״כ בקשות" value={leads.length} />
      </div>

      <section className="card action-panel">
        <UserRoundPlus />
        <h2>איך הזרימה עובדת?</h2>
        <p>המרה יוצרת משתמש הורה וכרטיס ילד במצב `pending_parent_completion`. רק אחרי שההורה משלים פרטים והמנהלת מאשרת, הילד הופך לפעיל ברשימת הילדים.</p>
      </section>

      <GardenParentLeadsCenter leads={leads} />
    </DashboardShell>
  );
}
