import { CommunicationCenter } from "@/components/communication-center";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenCommunicationPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const [logsResult, templatesResult, settingsResult] = await Promise.all([
    profile.garden_id
      ? supabase.from("communication_logs" as any).select("*").eq("kindergarten_id", profile.garden_id).order("created_at", { ascending: false }).limit(150)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("communication_templates" as any).select("*").order("audience_role", { ascending: true }).order("template_key", { ascending: true }),
    profile.garden_id
      ? supabase.from("kindergarten_communication_settings" as any).select("*").eq("garden_id", profile.garden_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (logsResult.error) console.error("[garden-communication-page] logs failed", { garden_id: profile.garden_id, error: logsResult.error.message });
  if (templatesResult.error) console.error("[garden-communication-page] templates failed", { error: templatesResult.error.message });
  if (settingsResult.error) console.error("[garden-communication-page] settings failed", { garden_id: profile.garden_id, error: settingsResult.error.message });

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="תקשורת">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">SMS / WhatsApp</p>
          <h1>מרכז תקשורת לגן.</h1>
          <p>כאן רואים הודעות שנוצרו מהמערכת, בוחרים ערוץ מועדף להורים ובודקים תבניות לפני חיבור ספק אמיתי.</p>
        </div>
        <span className="pill warn">Mock mode</span>
      </div>
      <CommunicationCenter
        role="garden"
        logs={(logsResult.data ?? []) as any[]}
        templates={(templatesResult.data ?? []) as any[]}
        settings={settingsResult.data as any}
        apiPath="/api/garden/communication"
      />
    </DashboardShell>
  );
}
