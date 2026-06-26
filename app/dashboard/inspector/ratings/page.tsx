import Link from "next/link";
import { AlertTriangle, BarChart3, ClipboardCheck, ShieldCheck, Star, TrendingDown } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { categoryScoreRows, ratingBandLabel, ratingTone, ratingTrendLabel } from "@/lib/domain/kindergarten-rating";
import {
  InspectorActionCard,
  InspectorActions,
  InspectorAppFrame,
  InspectorEmpty,
  InspectorHero,
  InspectorList,
  InspectorMetricCard,
  InspectorMetricGrid,
  InspectorRow,
  InspectorScoreRing,
  InspectorSection,
  InspectorStatus
} from "@/components/inspector-app-ui";

function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row[key] ?? 0)).filter((value) => value > 0);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function toTone(value: string | number) {
  const tone = ratingTone(value as any);
  return tone === "good" ? "success" : tone === "warn" ? "warning" : tone === "bad" ? "danger" : "primary";
}

function impactLevelLabel(value?: string | null) {
  const labels: Record<string, string> = {
    critical: "קריטי",
    high: "גבוה",
    medium: "בינוני",
    low: "נמוך"
  };
  return labels[String(value ?? "").toLowerCase()] ?? "דורש בדיקה";
}

function impactTone(value?: string | null) {
  const key = String(value ?? "").toLowerCase();
  if (key === "critical" || key === "high") return "danger";
  if (key === "medium") return "warning";
  return "primary";
}

export default async function InspectorRatingsPage() {
  const { profile } = await requireRole(["inspector"]);
  const result = await safeAdminData("inspector ratings", async () => {
    const supabase = await createClient();
    const [inspectorRes, gardensRes] = await Promise.all([
      supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
      supabase.from("gardens" as any).select("id,name,city").eq("inspector_id", profile.id).order("name")
    ]);
    logSupabaseError("inspector ratings gardens", gardensRes.error);
    const gardens = (gardensRes.data ?? []) as any[];
    const gardenIds = gardens.map((garden: any) => garden.id);
    const [ratingsRes, recommendationsRes] = gardenIds.length ? await Promise.all([
      supabase.from("kindergarten_rating_profiles" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).order("overall_score", { ascending: true }).limit(200),
      supabase.from("kindergarten_rating_recommendations" as any).select("id,garden_id,category,title,impact_level,status,gardens(name,city)").in("garden_id", gardenIds).eq("status", "open").order("impact_level", { ascending: false }).limit(100)
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    [ratingsRes, recommendationsRes].forEach((query, index) => logSupabaseError(`inspector ratings query ${index}`, (query as any).error));
    return {
      gardens,
      ratings: (ratingsRes.data ?? []) as any[],
      recommendations: (recommendationsRes.data ?? []) as any[],
      profilePhoto: (inspectorRes.data as any)?.profile_photo_url ?? null,
      queryError: ratingsRes.error ? "חלק מנתוני הדירוג לא נטענו" : null
    };
  }, { gardens: [] as any[], ratings: [] as any[], recommendations: [] as any[], profilePhoto: null as string | null, queryError: null as string | null });

  const data = result.data;
  const profileForUi = { ...profile, profile_image_url: data.profilePhoto ?? profile.profile_image_url };
  const average = avg(data.ratings, "overall_score");
  const declining = data.ratings.filter((rating: any) => rating.trend === "declining" || Number(rating.overall_score ?? 0) < 65);
  const sample = data.ratings[0] ?? {};

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="דירוג גנים" subtitle="איכות, בטיחות וציות בגנים שבאחריותך" badge="דירוג" backHref="/dashboard/inspector">
      <InspectorHero
        eyebrow="דירוג מקצועי"
        title="הגנים לפי עדיפות פיקוח"
        subtitle="ציון שקוף שמכוון פעולה מקצועית. הוא לא מחליף ביקורת פקח ולא מפעיל החלטות אוטומטיות."
        artwork={<Star />}
        action={<Link className="inspector-action-button" href="/dashboard/inspector/inspections/due">ביקורות קרובות</Link>}
        meta={<><span>{data.gardens.length} גנים</span><span>{declining.length} דורשים תשומת לב</span></>}
      />
      <AdminDataError message={result.error ?? data.queryError} />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="ממוצע משויך" value={`${average}/100`} hint="ציון כללי" icon={BarChart3} tone={toTone(average)} />
        <InspectorMetricCard label="גנים מדורגים" value={data.ratings.length} hint="מתוך הגנים שלך" icon={Star} tone="success" />
        <InspectorMetricCard label="בירידה" value={declining.length} hint="דורשים תשומת לב" icon={TrendingDown} tone={declining.length ? "warning" : "success"} />
        <InspectorMetricCard label="המלצות פתוחות" value={data.recommendations.length} hint="לטיפול מקצועי" icon={AlertTriangle} tone={data.recommendations.length ? "warning" : "success"} />
      </InspectorMetricGrid>

      <InspectorSection title="רכיבי הדירוג" subtitle="ממוצע לפי קטגוריות" icon={BarChart3}>
        <InspectorMetricGrid columns={5}>
          {categoryScoreRows(sample).map((row) => (
            <InspectorMetricCard key={row.key} label={row.label} value={`${avg(data.ratings, `${row.key}_score`)}/100`} hint={row.description} icon={Star} />
          ))}
        </InspectorMetricGrid>
      </InspectorSection>

      <InspectorSection title="גנים לפי עדיפות" subtitle="הציון הנמוך ביותר מופיע ראשון" icon={Star}>
        <InspectorList>
          {data.ratings.map((rating: any) => (
            <InspectorRow
              key={rating.id}
              href={`/dashboard/inspector/inspections?garden=${rating.garden_id}`}
              title={rating.gardens?.name ?? "גן"}
              subtitle={rating.gardens?.city ?? ""}
              meta={`${ratingBandLabel(rating.rating_band)} · ${ratingTrendLabel(rating.trend)}`}
              status={<InspectorScoreRing value={rating.overall_score ?? "-"} />}
            />
          ))}
          {data.ratings.length === 0 ? <InspectorEmpty title="אין דירוגים להצגה" text="לאחר חישוב הדירוגים, הגנים המשויכים יופיעו כאן." icon={Star} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorSection title="המלצות לפעולה" subtitle="פתוח לבדיקה מקצועית" icon={AlertTriangle}>
        <InspectorList>
          {data.recommendations.map((rec: any) => (
            <InspectorRow
              key={rec.id}
              title={rec.title}
              subtitle={rec.gardens?.name ?? "גן"}
              meta={rec.category}
              status={<InspectorStatus tone={impactTone(rec.impact_level)}>{impactLevelLabel(rec.impact_level)}</InspectorStatus>}
            />
          ))}
          {data.recommendations.length === 0 ? <InspectorEmpty title="אין המלצות פתוחות" text="כאשר תיווצר המלצה מקצועית, היא תופיע כאן." icon={ShieldCheck} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorActions>
        <InspectorActionCard title="ביקורות" text="תכנון וביצוע" href="/dashboard/inspector/inspections/due" icon={ClipboardCheck} />
        <InspectorActionCard title="ליקויים" text="סגירה ואימות" href="/dashboard/inspector/violations" icon={ShieldCheck} />
        <InspectorActionCard title="ציות" text="מסמכים וממצאים" href="/dashboard/inspector/compliance" icon={Star} />
      </InspectorActions>
    </InspectorAppFrame>
  );
}
