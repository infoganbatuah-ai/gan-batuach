import { CommunicationCenter } from "@/components/communication-center";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCommunicationPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [logsResult, templatesResult] = await Promise.all([
    supabase.from("communication_logs" as any).select("*").order("created_at", { ascending: false }).limit(250),
    supabase.from("communication_templates" as any).select("*").order("audience_role", { ascending: true }).order("template_key", { ascending: true })
  ]);

  if (logsResult.error) console.error("[admin-communication-page] logs failed", { error: logsResult.error.message });
  if (templatesResult.error) console.error("[admin-communication-page] templates failed", { error: templatesResult.error.message });

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
      <CommunicationCenter
        role="admin"
        logs={(logsResult.data ?? []) as any[]}
        templates={(templatesResult.data ?? []) as any[]}
        apiPath="/api/admin/communication"
      />
    </DashboardShell>
  );
}
