import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorReportsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const gardensRes = await supabase.from("gardens" as any).select("id").eq("inspector_id", profile.id);
  const ids = (gardensRes.data ?? []).map((g: any) => g.id);
  const complaints = ids.length ? await supabase.from("complaints" as any).select("id, subject, severity, status, created_at, gardens(name)").in("garden_id", ids).order("created_at", { ascending: false }) : { data: [] };
  const incidents = ids.length ? await supabase.from("incident_reports" as any).select("id, title, severity, status, created_at, gardens(name)").in("garden_id", ids).order("created_at", { ascending: false }) : { data: [] };
  const rows = [...(complaints.data ?? []), ...(incidents.data ?? [])].map((row: any) => ({ ...row, name: row.subject ?? row.title, description: `${row.gardens?.name ?? ""} · ${row.severity ?? ""}` }));
  return <DashboardShell role="inspector" title="דיווחים לפקח"><ModuleListPage title="דיווחים ופניות בגנים המשויכים" eyebrow="Inspector Reports" description="הפקח רואה רק פניות, תלונות ואירועים של גנים שהוקצו לו." rows={rows} emptyTitle="אין דיווחים פתוחים" emptyText="כאשר הורה, גן או AI ייצרו אירוע בגנים שלך, הוא יופיע כאן." /></DashboardShell>;
}
