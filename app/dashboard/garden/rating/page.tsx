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

function teacherTone(tone: string): "red" | "orange" | "green" | "purple" {
  if (tone === "bad") return "red";
  if (tone === "warn") return "orange";
  if (tone === "good") return "green";
  return "purple";
}

type GardenRating = { overall_score?: number | null; safety_score?: number | null; compliance_score?: number | null; inspection_score?: number | null; parent_satisfaction_score?: number | null; observer_score?: number | null; rating_band?: string | null; trend?: string | null; explanation?: { why_score_decreased?: unknown; how_to_improve?: unknown } | null; gardens?: { name?: string | null; city?: string | null } };
type RatingRecommendation = { id: string; title: string; explanation?: string; impact_level: string };

async function ratingQuery(label: string, query: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query();
    logSupabaseError(label, result.error);
    return result.error ? { data: null, error: true } : { data: result.data, error: false };
  } catch {
    logSupabaseError(label, true);
    return { data: null, error: true };
  }
}

export default async function GardenRatingPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) {
    return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="דירוג הגן" appHome><AdminDataError message="לא ניתן לטעון דירוג ללא שיוך לגן" /></DashboardShell>;
  }
  const result = await safeAdminData("garden rating", async () => {
    const supabase = await createClient();
    const [ratingRes, historyRes, recommendationsRes] = await Promise.all([
      ratingQuery("garden rating profile", () => supabase.from("kindergarten_rating_profiles" as any).select("*, gardens(name,city)").eq("garden_id", gardenId).maybeSingle()),
      ratingQuery("garden rating history", () => supabase.from("kindergarten_rating_history" as any).select("*").eq("garden_id", gardenId).order("snapshot_date", { ascending: false }).limit(30)),
      ratingQuery("garden rating recommendations", () => supabase.from("kindergarten_rating_recommendations" as any).select("*").eq("garden_id", gardenId).eq("status", "open").order("impact_level", { ascending: false }).limit(20))
    ]);
    const available = [ratingRes, historyRes, recommendationsRes].map((query) => !query.error);
    return { rating: ratingRes.data as GardenRating | null, history: (historyRes.data ?? []) as unknown[], recommendations: (recommendationsRes.data ?? []) as RatingRecommendation[], available, queryError: available.some((value) => !value) ? "חלק מנתוני דירוג הגן לא נטענו" : null };
  }, { rating: null as GardenRating | null, history: [] as unknown[], recommendations: [] as RatingRecommendation[], available: [false, false, false], queryError: null as string | null });

  const data = result.data;
  const rating: GardenRating | null = data.available[0] ? data.rating ?? { overall_score: 0, safety_score: 0, compliance_score: 0, inspection_score: 0, parent_satisfaction_score: 0, observer_score: 0, rating_band: "new", trend: "new", explanation: {}, gardens: {} } : null;
  const reasons = rating ? cleanRatingReasons(rating.explanation?.why_score_decreased) : [];
  const improvements = rating ? cleanRatingReasons(rating.explanation?.how_to_improve) : [];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="דירוג הגן" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="דירוג איכות ובטיחות" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={Star} title="דירוג איכות ובטיחות הגן" subtitle="הציון מחושב לפי בטיחות, ציות, פיקוח, שביעות רצון ותצפיתן" action={<Link className="button primary" href="/dashboard/garden/compliance">שיפור ציות</Link>} />
        <AdminDataError message={result.error ?? data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="ציון כללי" value={rating ? `${rating.overall_score}/100` : "לא זמין"} hint={rating ? ratingBandLabel(rating.rating_band) : "רמת הדירוג לא זמינה"} icon={Star} tone={rating ? teacherTone(ratingTone(Number(rating.overall_score ?? 0))) : "neutral"} />
          <TeacherStatCard title="בטיחות" value={rating ? `${rating.safety_score}/100` : "לא זמין"} hint="אירועים וסטטוס" icon={ShieldCheck} tone={rating ? teacherTone(ratingTone(Number(rating.safety_score ?? 0))) : "neutral"} />
          <TeacherStatCard title="ציות" value={rating ? `${rating.compliance_score}/100` : "לא זמין"} hint="מסמכים ותוקף" icon={FileText} tone={rating ? teacherTone(ratingTone(Number(rating.compliance_score ?? 0))) : "neutral"} />
          <TeacherStatCard title="תצפיתן" value={rating ? `${rating.observer_score}/100` : "לא זמין"} hint={rating ? ratingTrendLabel(rating.trend) : "מגמת הדירוג לא זמינה"} icon={TrendingUp} tone={rating ? teacherTone(ratingTone(Number(rating.observer_score ?? 0))) : "neutral"} />
        </TeacherStatsGrid>

        <TeacherSection title="רכיבי הציון">
          {!rating ? <TeacherEmptyState title="רכיבי הציון לא זמינים" /> : <TeacherCompactList>
            {categoryScoreRows(rating).map((row) => (
              <TeacherCompactItem key={row.key} title={row.label} subtitle={row.description} tone={teacherTone(ratingTone(Number(row.value ?? 0)))} meta={`${row.value}/100`} />
            ))}
          </TeacherCompactList>}
        </TeacherSection>

        <section className="teacher-children-layout">
          <TeacherSection title="מה משפיע על הציון">
            {!rating ? <TeacherEmptyState title="הגורמים לציון לא זמינים" /> : reasons.length === 0 ? <TeacherEmptyState title="אין גורמים חריגים שמורידים את הציון" /> : (
              <TeacherCompactList>{reasons.map((reason) => <TeacherCompactItem key={reason} title={reason} subtitle="ניתן לטפל ולשפר" tone="orange" meta="פתוח" />)}</TeacherCompactList>
            )}
          </TeacherSection>
          <TeacherSection title="מה משפר את הציון">
            {!rating ? <TeacherEmptyState title="נתוני השיפור לא זמינים" /> : improvements.length === 0 ? <TeacherEmptyState title="אין המלצות זמינות" /> : (
              <TeacherCompactList>{improvements.map((item) => <TeacherCompactItem key={item} title={item} subtitle="פעולה מומלצת" tone="green" meta="שיפור" />)}</TeacherCompactList>
            )}
          </TeacherSection>
        </section>

        <TeacherSection title="המלצות פתוחות">
          {!data.available[2] ? <TeacherEmptyState title="ההמלצות הפתוחות לא זמינות" text="לא ניתן לטעון המלצות כרגע." /> : data.recommendations.length === 0 ? <TeacherEmptyState title="אין המלצות פתוחות" text="כשהמערכת תזהה פעולה לשיפור, היא תופיע כאן." /> : (
            <TeacherCompactList>
              {data.recommendations.map((rec) => <TeacherCompactItem key={rec.id} title={rec.title} subtitle={rec.explanation} tone={rec.impact_level === "high" ? "red" : "orange"} meta={rec.impact_level} />)}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherAiInsight metric={rating ? `${rating.overall_score}/100` : "לא זמין"}>
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
