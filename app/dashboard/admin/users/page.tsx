import Link from "next/link";
import { UsersRound } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { AdminUsersManagement } from "@/components/admin-users-management";
import { PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";

export default async function AdminUsersPage() {
  const { profile } = await requireRole(["admin"]);
  const configured = isAdminClientConfigured();
  const result = await safeAdminData("ניהול משתמשים", async () => {
    const supabase = await createClient();
    const [usersRes, credentialsRes, logsRes] = await Promise.all([
      supabase.from("profiles" as any).select("id, role, garden_id, full_name, phone, active, must_change_password, last_login_at, created_at, created_by, username, email, profile_image_url, gardens:garden_id(id,name,city,inspector_id)").order("created_at", { ascending: false }).limit(500),
      supabase.from("generated_credentials" as any).select("id,user_id,username,temporary_password,created_at,password_changed_at,reset_sent_at").order("created_at", { ascending: false }).limit(1000),
      supabase.from("audit_logs" as any).select("id, actor_id, actor_role, entity_type, entity_id, action, created_at").order("created_at", { ascending: false }).limit(30)
    ]);
    logSupabaseError("ניהול משתמשים", usersRes.error ?? credentialsRes.error ?? logsRes.error);
    const credentialsByUser = new Map<string, any[]>();
    for (const credential of (credentialsRes.data ?? []) as any[]) {
      const list = credentialsByUser.get(credential.user_id) ?? [];
      list.push(credential);
      credentialsByUser.set(credential.user_id, list);
    }
    const users = ((usersRes.data ?? []) as any[]).map((user) => ({ ...user, generated_credentials: credentialsByUser.get(user.id) ?? [] }));
    return { users, auditLogs: (logsRes.data ?? []) as any[], queryError: usersRes.error || credentialsRes.error || logsRes.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { users: [] as any[], auditLogs: [] as any[], queryError: null as string | null });

  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/users" title="ניהול משתמשים" subtitle="חשבונות, הרשאות, שיוכים ופעולות זהירות במקום אחד." badge="משתמשים">
    <PremiumCard size="lg" className="admin-section-card">
      <SectionHeader eyebrow="משתמשים" title="ניהול חשבונות והרשאות" subtitle="מנהלות, הורים, צוות, מפקחים ואדמין, עם Audit ושיוך גן ברור." icon={UsersRound} />
      <StatusChip tone={configured ? "success" : "danger"}>{configured ? "מוכן לפעולות אדמין" : "נדרשת הגדרת Service Role"}</StatusChip>
    </PremiumCard>
    {!configured ? <div className="error-banner">SUPABASE_SERVICE_ROLE_KEY חסר. יצירת משתמשים ואיפוס סיסמה דורשים להגדיר אותו ב-Vercel Environment Variables.</div> : null}
    <AdminDataError message={result.error ?? result.data.queryError} />
    <AdminUsersManagement users={result.data.users} auditLogs={result.data.auditLogs} />
  </AdminAppFrame>;
}
