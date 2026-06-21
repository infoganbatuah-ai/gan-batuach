import { Bell, MessageCircle, Send, Settings, Smartphone } from "lucide-react";
import { CommunicationCenter } from "@/components/communication-center";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

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

  const logs = (logsResult.data ?? []) as any[];
  const templates = (templatesResult.data ?? []) as any[];
  const failed = logs.filter((log) => ["failed", "error"].includes(String(log.status)));
  const sent = logs.filter((log) => ["sent", "delivered"].includes(String(log.status)));
  const pending = logs.filter((log) => ["pending", "queued", "mock"].includes(String(log.status)));
  const settings = settingsResult.data as any;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="תקשורת" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`} subtitle="הודעות להורים ולצוות" avatarUrl={(profile as any).avatar_url ?? null} active="messages">
        <TeacherPageTitle icon={MessageCircle} title="מרכז תקשורת" subtitle="הודעות מערכת, תבניות וערוצי שליחה במקום אחד" action={<a className="button primary" href="#communication-manager"><Send size={18} /> ניהול מלא</a>} />

        <TeacherStatsGrid>
          <TeacherStatCard title="נשלחו" value={sent.length} hint="נמסרו/נשלחו" icon={Send} tone="green" />
          <TeacherStatCard title="ממתינות" value={pending.length} hint="תור שליחה" icon={Bell} tone={pending.length ? "orange" : "blue"} />
          <TeacherStatCard title="שגיאות" value={failed.length} hint="דורש בדיקה" icon={Smartphone} tone={failed.length ? "red" : "green"} />
          <TeacherStatCard title="תבניות" value={templates.length} hint="מוכנות" icon={Settings} tone="purple" />
        </TeacherStatsGrid>

        <TeacherSection title="הודעות אחרונות" action={<a href="#communication-manager">לכל התקשורת ›</a>}>
          {logs.length ? (
            <TeacherCompactList>
              {logs.slice(0, 6).map((log) => (
                <TeacherCompactItem
                  key={log.id}
                  title={log.title ?? log.subject ?? log.template_key ?? "הודעה"}
                  subtitle={`${log.channel ?? "ערוץ"} · ${log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : "ללא תאריך"}`}
                  tone={["failed", "error"].includes(String(log.status)) ? "red" : ["sent", "delivered"].includes(String(log.status)) ? "green" : "purple"}
                  meta={log.status ?? "מוכן"}
                />
              ))}
            </TeacherCompactList>
          ) : (
            <TeacherEmptyState title="אין הודעות עדיין" text="הודעות שיישלחו מהמערכת יופיעו כאן עם ערוץ וסטטוס." />
          )}
        </TeacherSection>

        <TeacherAiInsight metric={settings?.provider_mode ?? "מוכן"}>
          אם ספק הודעות אמיתי לא מחובר, המסך נשאר במצב בדיקה ולא מציג כאילו נשלחו הודעות production.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות תקשורת">
          <TeacherActionTile title="הודעות הורים" href="/dashboard/garden/messages" icon={MessageCircle} tone="purple" />
          <TeacherActionTile title="התראות" href="/dashboard/garden/notifications" icon={Bell} tone="orange" />
          <TeacherActionTile title="בקשות הצטרפות" href="/dashboard/garden/enrollment-requests" icon={Send} tone="blue" />
        </TeacherQuickActions>

        <details className="teacher-management-details" id="communication-manager">
          <summary>ניהול מלא של תקשורת</summary>
          <div className="teacher-embedded-module">
            <CommunicationCenter
              role="garden"
              logs={logs}
              templates={templates}
              settings={settings}
              apiPath="/api/garden/communication"
            />
          </div>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
