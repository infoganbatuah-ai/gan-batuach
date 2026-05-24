import { BookOpenCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProceduresManager } from "@/components/procedures-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { AdminDataError } from "@/components/admin-data-state";

export default async function AdminProceduresPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin procedures", async () => {
    const supabase = await createClient();
    const [procedures, gardens, acknowledgements, auditLogs] = await Promise.all([
      supabase.from("mandatory_procedures" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("gardens" as any).select("id, name, city, manager_id").order("name"),
      supabase.from("procedure_acknowledgements" as any).select("procedure_id, acknowledged_at, acknowledged_by").order("acknowledged_at", { ascending: false }).limit(20),
      supabase.from("audit_logs" as any).select("action, created_at, after_data").eq("entity_type", "mandatory_procedures").order("created_at", { ascending: false }).limit(20)
    ]);
    [procedures, gardens, acknowledgements, auditLogs].forEach((res, index) => logSupabaseError("admin procedures " + index, res.error));
    return { procedures: procedures.data ?? [], gardens: gardens.data ?? [], acknowledgements: acknowledgements.data ?? [], auditLogs: auditLogs.data ?? [], queryError: [procedures, gardens, acknowledgements, auditLogs].some((res) => res.error) ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { procedures: [] as any[], gardens: [] as any[], acknowledgements: [] as any[], auditLogs: [] as any[], queryError: null as string | null });
  return <DashboardShell role="admin" title="ניהול נהלים"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">נהלים מחייבים</p><h1>מסך ניהול נהלים אמיתי, לא JSON.</h1><p>יצירה, עריכה, שיוך, חובת אישור, צפייה בביצוע ולוג ביקורת.</p></div><span className="pill good"><BookOpenCheck size={15} /> Procedures UI</span></div><AdminDataError message={result.error ?? result.data.queryError} /><ProceduresManager procedures={result.data.procedures as any} gardens={result.data.gardens as any} acknowledgements={result.data.acknowledgements as any} auditLogs={result.data.auditLogs as any} /></DashboardShell>;
}
