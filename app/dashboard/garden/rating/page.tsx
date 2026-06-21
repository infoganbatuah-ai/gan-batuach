import Link from "next/link";
import { ClipboardCheck, FileText, ShieldCheck, Star, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { categoryScoreRows, cleanRatingReasons, publicRatingBoundary, ratingBandLabel, ratingTone, ratingTrendLabel, ratingWeights } from "@/lib/domain/kindergarten-rating";
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

function teacherTone(tone: string) {
  if (tone === "bad") return "red";
  if (tone === "warn") return "orange";
  if (tone === "good") return "green";
  return "purple";
}

export default async function GardenRatingPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden rating", async () => {
    const supabase = await createClient();
    const [ratingRes, historyRes, recommendationsRes] = await Promise.all([
      supabase.from("kindergarten_rating_profiles" as any).select("*, gardens(name,city)").eq("garden_id", gardenId).maybeSingle(),
      supabase.from("kindergarten_rating_history" as any).select("*").eq("garden_id", gardenId).order("snapshot_date", { ascending: false }).limit(30),
      supabase.from("kindergarten_rating_recommendations" as any).select("*").eq("garden_id", gardenId).eq("status", "open").order("impact_level", { ascending: false }).limit(20)
    ]);
    [ratingRes, historyRes, recommendationsRes].forEach((query, index) => logSupabaseError(`garden rating ${index}`, (query as any).error));
    return { rating: ratingRes.data as any, history: (historyRes.data ?? []) as any[], recommendations: (recommendationsRes.data ?? []) as any[], queryError: ratingRes.error ? "דירוג הגן עדיין לא נטען. ייתכן שהמיגרציה לא הורצה." : null };
  }, { rating: null as any, history: [] as any[], recommendations: [] as any[], queryError: null as string | null });

  const data = result.data;
  const rating = data.rating ?? { overall_score: 0, safety_score: 0, compliance_score: 0, inspection_score: 0, parent_satisfaction_score: 0, observer_score: 0, rating_band: "new", trend: "new", explanation: {}, gardens: {} };
  const reasons = cleanRatingReasons(rating.explanation?.why_score_decreased);
  const improvements = cleanRatingReasons(rating.explanation?.how_to_improve);

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="דירוג הגן" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`} subtitle="דירוג איכות ובטיחות" avatarUrl={(profile as any).avatar_url ?? null} active="more">
        <TeacherPageTitle icon={Star} title="דירוג איכות ובטיחות הגן" subtitle="הציון מחושב לפי בטיחות, ציות, פיקוח, שביעות רצון ותצפיתן" action={<Link className="button primary" href="/dashboard/garden/compliance">שיפור ציות</Link>} />
        <AdminDataError message={result.error ?? data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="ציון כללי" value={`${rating.overall_score}/100`} hint={ratingBandLabel(rating.rating_band)} icon={Star} tone={teacherTone(ratingTone(Number(rating.overall_score ?? 0))) as any} />
          <TeacherStatCard title="בטיחות" value={`${rating.safety_score}/100`} hint="אירועים וסטטוס" icon={ShieldCheck} tone={teacherTone(ratingTone(Number(rating.safety_score ?? 0))) as any} />
          <TeacherStatCard title="ציות" value={`${rating.compliance_score}/100`} hint="מסמכים ותוקף" icon={FileText} tone={teacherTone(ratingTone(Number(rating.compliance_score ?? 0))) as any} />
          <TeacherStatCard title="תצפיתן" value={`${rating.observer_score}/100`} hint={ratingTrendLabel(rating.trend)} icon={TrendingUp} tone={teacherTone(ratingTone(Number(rating.observer_score ?? 0))) as any} />
        </TeacherStatsGrid>

        <TeacherSection title="רכיבי הציון">
          <TeacherCompactList>
            {categoryScoreRows(rating).map((row) => (
              <TeacherCompactItem key={row.key} title={row.label} subtitle={row.description} tone={teacherTone(ratingTone(Number(row.value ?? 0))) as any} meta={`${row.value}/100`} />
            ))}
          </TeacherCompactList>
        </TeacherSection>

        <section className="teacher-children-layout">
          <TeacherSection title="מה משפיע על הציון">
            {reasons.length === 0 ? <TeacherEmptyState title="אין גורמים חריגים שמורידים את הציון" /> : (
              <TeacherCompactList>{reasons.map((reason) => <TeacherCompactItem key={reason} title={reason} subtitle="ניתן לטפל ולשפר" tone="orange" meta="פתוח" />)}</TeacherCompactList>
            )}
          </TeacherSection>
          <TeacherSection title="מה משפר את הציון">
            {improvements.length === 0 ? <TeacherEmptyState title="אין המלצות זמינות" /> : (
              <TeacherCompactList>{improvements.map((item) => <TeacherCompactItem key={item} title={item} subtitle="פעולה מומלצת" tone="green" meta="שיפור" />)}</TeacherCompactList>
            )}
          </TeacherSection>
        </section>

        <TeacherSection title="המלצות פתוחות">
          {data.recommendations.length === 0 ? <TeacherEmptyState title="אין המלצות פתוחות" text="כשהמערכת תזהה פעולה לשיפור, היא תופיע כאן." /> : (
            <TeacherCompactList>
              {data.recommendations.map((rec: any) => <TeacherCompactItem key={rec.id} title={rec.title} subtitle={rec.explanation} tone={rec.impact_level === "high" ? "red" : "orange"} meta={rec.impact_level} />)}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherAiInsight metric={`${rating.overall_score}/100`}>
          {ratingWeights.map((item) => `${item.label} ${item.weight}%`).join(" · ")}. {publicRatingBoundary[0]}
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות דירוג">
          <TeacherActionTile title="ציות" href="/dashboard/garden/compliance" icon={FileText} tone="purple" />
          <TeacherActionTile title="פיקוח" href="/dashboard/garden/inspections" icon={ClipboardCheck} tone="blue" />
          <TeacherActionTile title="בטיחות" href="/dashboard/garden/incidents" icon={ShieldCheck} tone="green" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
