import { CommunicationCenter } from "@/components/communication-center";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { managementDeliveryCapability } from "@/lib/management/external-delivery";

export default async function AdminCommunicationPage() {
  await requireRole(["admin"]);
  const unavailable = { data: null, available: false };
  const result = await safeAdminData("admin-communication", async () => {
    const supabase = await createClient();
    async function readSource<T extends { data: unknown; error: unknown }>(label: string, query: () => PromiseLike<T>) {
      const source = await safeAdminData(label, async () => {
        const response = await query();
        logSupabaseError(label, response.error);
        return { data: response.error ? null : response.data, available: !response.error };
      }, unavailable);
      return source.data;
    }
    const [logsResult, templatesResult] = await Promise.all([
      readSource("admin-communication logs", () => supabase.from("communication_logs" as any).select("*").order("created_at", { ascending: false }).limit(250)),
      readSource("admin-communication templates", () => supabase.from("communication_templates" as any).select("*").order("audience_role", { ascending: true }).order("template_key", { ascending: true }))
    ]);
    return { logsResult, templatesResult };
  }, { logsResult: unavailable, templatesResult: unavailable });
  const { logsResult, templatesResult } = result.data;

  return (
    <DashboardShell role="admin" title="תקשורת מערכת">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Communication Center</p>
          <h1>SMS, WhatsApp ו-Email במצב בדיקה.</h1>
          <p>מרכז בקרה לכל הודעות התקשורת שנוצרו מהמערכת, כולל כשלונות, תבניות וניסיונות חוזרים.</p>
        </div>
        <span className="pill warn">Mock provider</span>
      </div>
      <AdminDataError message={result.error ?? (!logsResult.available || !templatesResult.available ? "לא ניתן לטעון חלק מנתוני התקשורת כרגע" : null)} />
      <CommunicationCenter
        role="admin"
        logs={(logsResult.data ?? []) as any[]}
        templates={(templatesResult.data ?? []) as any[]}
        logsAvailable={logsResult.available}
        templatesAvailable={templatesResult.available}
        apiPath="/api/admin/communication"
        capability={managementDeliveryCapability()}
      />
    </DashboardShell>
  );
}
