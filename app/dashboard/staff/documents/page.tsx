import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffDocumentsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const { data } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at").eq("staff_id", (staffRes.data as any)?.id ?? "").order("created_at", { ascending: false });
  return <DashboardShell role="staff" title="מסמכים"><ModuleListPage title="מסמכי עובד ותעודות" eyebrow="Staff Documents" description="תעודת יושר, בדיקת רקע, הכשרות, עזרה ראשונה ותוקף מסמכים." rows={(data ?? []) as any[]} emptyTitle="אין מסמכים להצגה" emptyText="כאשר מנהלת תעלה או תאשר מסמכי עובד, הם יופיעו כאן." /></DashboardShell>;
}
