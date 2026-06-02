import { DashboardShell } from "@/components/dashboard-shell";
import { SmartInsightsCenter } from "@/components/smart-insights-center";
import { requireRole } from "@/lib/auth";
import {
  createNotificationsForUrgentInsights,
  generateSmartInsights,
  syncSmartInsights
} from "@/lib/domain/smart-kindergarten-engine";
import { createClient } from "@/lib/supabase/server";

export default async function GardenInsightsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const generated = await generateSmartInsights(supabase as any, profile);
  const insights = await syncSmartInsights(supabase as any, generated);
  await createNotificationsForUrgentInsights(supabase as any, insights);

  const urgent = insights.filter((item) => item.severity === "urgent" || item.severity === "critical").length;
  const warnings = insights.filter((item) => item.severity === "warning").length;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="תובנות חכמות">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">Smart Kindergarten Engine</p>
          <h1>תובנות חכמות.</h1>
          <p>המנוע בודק נוכחות, יומן יומי, פניות, תשלומים, מסמכים, אירועים, מצלמות ופיקוח ומציג רק מה שדורש פעולה.</p>
        </div>
        <span className={urgent ? "pill bad" : warnings ? "pill warn" : "pill good"}>{urgent ? `${urgent} דחופות` : warnings ? `${warnings} המלצות` : "הכל רגוע"}</span>
      </div>
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>דחוף</span><strong>{urgent}</strong></article>
        <article className="card metric-card"><span>היום</span><strong>{insights.filter((item) => item.status === "open").length}</strong></article>
        <article className="card metric-card"><span>השבוע</span><strong>{insights.length}</strong></article>
        <article className="card metric-card"><span>טופלו</span><strong>{insights.filter((item) => item.status === "handled").length}</strong></article>
      </section>
      <SmartInsightsCenter insights={insights} />
    </DashboardShell>
  );
}
