import { BookOpenCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProceduresManager } from "@/components/procedures-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminProceduresPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [procedures, gardens, acknowledgements, auditLogs] = await Promise.all([
    supabase.from("mandatory_procedures").select("*").order("created_at", { ascending: false }),
    supabase.from("gardens").select("id, name, city, manager_id").order("name"),
    supabase.from("procedure_acknowledgements").select("procedure_id, acknowledged_at, acknowledged_by, gardens(name), profiles(full_name)").order("acknowledged_at", { ascending: false }).limit(20),
    supabase.from("audit_logs").select("action, created_at, after_data").eq("entity_type", "mandatory_procedures").order("created_at", { ascending: false }).limit(20)
  ]);
  return <DashboardShell role="admin" title="ניהול נהלים"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">נהלים מחייבים</p><h1>מסך ניהול נהלים אמיתי, לא JSON.</h1><p>יצירה, עריכה, שיוך, חובת אישור, צפייה בביצוע ולוג ביקורת.</p></div><span className="pill good"><BookOpenCheck size={15} /> Procedures UI</span></div><ProceduresManager procedures={(procedures.data ?? []) as any} gardens={(gardens.data ?? []) as any} acknowledgements={(acknowledgements.data ?? []) as any} auditLogs={(auditLogs.data ?? []) as any} /></DashboardShell>;
}
