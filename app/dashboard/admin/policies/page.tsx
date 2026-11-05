import { DashboardShell } from "@/components/dashboard-shell";
import { PoliciesManager } from "@/components/policies-manager";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";

export default async function AdminPoliciesPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("policies", async () => {
    const supabase = await createClient();
    const query = async <T,>(load: () => PromiseLike<{ data: T | null; error: unknown }>) => {
      try {
        const { data, error } = await load();
        return { data: error ? null : data, error, available: !error };
      } catch {
        return { data: null, error: true, available: false };
      }
    };
    const [policies, acceptances] = await Promise.all([
      query(() => supabase.from("policies" as any).select("*").order("policy_type").order("version", { ascending: false })),
      query(() => supabase.from("policy_acceptances" as any).select("*, profiles:user_id(full_name, role)").order("accepted_at", { ascending: false }).limit(200))
    ]);
    logSupabaseError("policies", policies.error ?? acceptances.error);
    return { policies: policies.data ?? [], acceptances: acceptances.data ?? [], policiesAvailable: policies.available, acceptancesAvailable: acceptances.available, queryError: !policies.available || !acceptances.available ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { policies: [] as any[], acceptances: [] as any[], policiesAvailable: false, acceptancesAvailable: false, queryError: null as string | null });
  return <DashboardShell role="admin" title="תקנונים"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Policies</p><h1>ניהול תקנונים ואישורי משתמשים.</h1><p>פרסום גרסאות חדשות מחייב את המשתמשים לאשר מחדש לפי תפקיד.</p></div><span className={result.data.policiesAvailable && result.data.acceptancesAvailable ? "pill good" : "pill"}>Policy Gate</span></div><AdminDataError message={result.error ?? result.data.queryError} /><PoliciesManager policies={result.data.policies as any[]} acceptances={result.data.acceptances as any[]} policiesAvailable={result.data.policiesAvailable} acceptancesAvailable={result.data.acceptancesAvailable} /></DashboardShell>;
}
