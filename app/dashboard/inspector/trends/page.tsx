import { BarChart3, CheckCircle2, ClipboardCheck, TrendingUp } from "lucide-react";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorEmpty, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection, InspectorTimeline } from "@/components/inspector-app-ui";

type InspectorPhoto = { profile_photo_url?: string | null };
type InspectionTrend = {
  id: string;
  completed_at?: string | null;
  weighted_score?: number | null;
  violation_count?: number | null;
  gardens?: { name?: string | null; city?: string | null } | null;
};

export default async function InspectorTrendsPage() {
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, inspectionsRes] = await Promise.all([
    supabase.from("inspectors").select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("inspections").select("id,garden_id,completed_at,weighted_score,violation_count,status,gardens(name,city)").eq("inspector_id", profile.id).eq("status", "done").order("completed_at", { ascending: false }).limit(100)
  ]);
  const rows = (inspectionsRes.data ?? []) as unknown as InspectionTrend[];
  const scores = rows.map((r) => Number(r.weighted_score)).filter(Number.isFinite);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as unknown as InspectorPhoto | null)?.profile_photo_url ?? profile.profile_image_url };
  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="מגמות והיסטוריה" subtitle="נתונים קנוניים מביקורות שהוגשו" badge="מגמות">
      <InspectorHero eyebrow="היסטוריית פיקוח" title="מגמה לאורך זמן, בלי להמציא מדדים" subtitle="המגמות נגזרות רק מציוני הביקורות והליקויים שנשמרו. אין תחזית או ציון AI." artwork={<TrendingUp />} />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="ביקורות שהושלמו" value={rows.length} hint="בטווח הטעון" icon={ClipboardCheck} />
        <InspectorMetricCard label="ציון ממוצע" value={average ?? "—"} hint="לפי דוחות שהוגשו" icon={BarChart3} />
        <InspectorMetricCard label="ליקויים שתועדו" value={rows.reduce((sum, r) => sum + Number(r.violation_count ?? 0), 0)} hint="לאורך ההיסטוריה" icon={CheckCircle2} tone="warning" />
      </InspectorMetricGrid>
      <InspectorSection title="ציר ביקורות" subtitle="גן, תאריך, ציון ומספר ממצאים" icon={BarChart3}>
        {rows.length ? <InspectorTimeline items={rows.map((row) => ({ title: `${row.gardens?.name ?? "גן"} — ציון ${row.weighted_score ?? "—"}`, text: `${row.violation_count ?? 0} ממצאים · ${row.gardens?.city ?? ""}`, date: row.completed_at ? new Date(row.completed_at).toLocaleDateString("he-IL") : "", tone: Number(row.weighted_score ?? 0) >= 80 ? "success" : "warning" }))} /> : <InspectorEmpty title="אין נתוני מגמה" text="לאחר השלמת ביקורות, ההיסטוריה תופיע כאן." icon={TrendingUp} />}
      </InspectorSection>
    </InspectorAppFrame>
  );
}
