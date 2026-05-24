import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { AdminUsersManagement } from "@/components/admin-users-management";
import { requireRole } from "@/lib/auth";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";

export default async function AdminUsersPage() {
  await requireRole(["admin"]);
  const configured = isAdminClientConfigured();
  const result = await safeAdminData("ניהול משתמשים", async () => {
    const supabase = await createClient();
    const [usersRes, logsRes] = await Promise.all([
      supabase.from("profiles" as any).select("id, role, garden_id, full_name, phone, active, must_change_password, last_login_at, created_at, created_by, username, email, gardens:garden_id(id,name,city,inspector_id), generated_credentials(id,username,temporary_password,created_at)").order("created_at", { ascending: false }).limit(300),
      supabase.from("audit_logs" as any).select("id, actor_id, actor_role, entity_type, entity_id, action, created_at").order("created_at", { ascending: false }).limit(30)
    ]);
    logSupabaseError("ניהול משתמשים", usersRes.error ?? logsRes.error);
    return { users: (usersRes.data ?? []) as any[], auditLogs: (logsRes.data ?? []) as any[], queryError: usersRes.error || logsRes.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { users: [] as any[], auditLogs: [] as any[], queryError: null as string | null });

  return <DashboardShell role="admin" title="ניהול משתמשים">
    <div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">User Management</p><h1>ניהול משתמשים מרכזי.</h1><p>גנים, פקחים, צוות, הורים, מנהלות ובעלים. פרטי התחברות שמורים לאדמין בלבד, פעולות איפוס והשבתה, ולוג ביקורת.</p></div><span className={configured ? "pill good" : "pill bad"}>{configured ? "Service Role configured" : "Service Role missing"}</span></div>
    {!configured ? <div className="error-banner">SUPABASE_SERVICE_ROLE_KEY חסר. יצירת משתמשים ואיפוס סיסמה דורשים להגדיר אותו ב-Vercel Environment Variables.</div> : null}
    <AdminDataError message={result.error ?? result.data.queryError} />
    <AdminUsersManagement users={result.data.users} auditLogs={result.data.auditLogs} />
  </DashboardShell>;
}
