import Link from "next/link";
import { AlertTriangle, ClipboardCheck, ShieldCheck, Star, TrendingDown } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { categoryScoreRows, ratingBandLabel, ratingTone, ratingTrendLabel } from "@/lib/domain/kindergarten-rating";

function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row[key] ?? 0)).filter((value) => value > 0);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export default async function InspectorRatingsPage() {
  const { profile } = await requireRole(["inspector"]);
  const result = await safeAdminData("inspector ratings", async () => {
    const supabase = await createClient();
    const gardensRes = await supabase.from("gardens" as any).select("id,name,city").eq("inspector_id", profile.id).order("name");
    logSupabaseError("inspector ratings gardens", gardensRes.error);
    const gardens = (gardensRes.data ?? []) as any[];
    const gardenIds = gardens.map((garden: any) => garden.id);
    const [ratingsRes, recommendationsRes] = gardenIds.length ? await Promise.all([
      supabase.from("kindergarten_rating_profiles" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).order("overall_score", { ascending: true }).limit(200),
      supabase.from("kindergarten_rating_recommendations" as any).select("id,garden_id,category,title,impact_level,status,gardens(name,city)").in("garden_id", gardenIds).eq("status", "open").order("impact_level", { ascending: false }).limit(100)
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    [ratingsRes, recommendationsRes].forEach((query, index) => logSupabaseError(`inspector ratings query ${index}`, (query as any).error));
    return { gardens, ratings: (ratingsRes.data ?? []) as any[], recommendations: (recommendationsRes.data ?? []) as any[], queryError: ratingsRes.error ? "חלק מנתוני הדירוג לא נטענו" : null };
  }, { gardens: [] as any[], ratings: [] as any[], recommendations: [] as any[], queryError: null as string | null });

  const data = result.data;
  const average = avg(data.ratings, "overall_score");
  const declining = data.ratings.filter((rating: any) => rating.trend === "declining" || Number(rating.overall_score ?? 0) < 65);
  const sample = data.ratings[0] ?? {};

  return (
    <DashboardShell role="inspector" title="דירוג גנים">
      <div className="commercial-dashboard rating-system-shell">
        <PremiumDashboardHero eyebrow="Ratings" title="דירוג הגנים שבאחריותך" subtitle="מבט פיקוח על איכות, בטיחות וציות. הציון שקוף ונועד לכוון פעולה, לא להחליף ביקורת מקצועית." badge={`${average}/100`} badgeTone={ratingTone(average)} actions={<Link className="button primary" href="/dashboard/inspector/inspections/due">ביקורות</Link>}>
          <div className="setup-checklist"><span>{data.gardens.length} גנים</span><span>{declining.length} דורשים תשומת לב</span><span>הסבר מלא לכל ציון</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="ממוצע משויך" value={`${average}/100`} tone={ratingTone(average)} />
          <RoleMetricCard label="גנים מדורגים" value={data.ratings.length} tone="good" />
          <RoleMetricCard label="דורשים תשומת לב" value={declining.length} tone={declining.length ? "warn" : "good"} />
          <RoleMetricCard label="המלצות פתוחות" value={data.recommendations.length} tone={data.recommendations.length ? "warn" : "good"} />
        </section>

        <section className="rating-score-grid">
          {categoryScoreRows(sample).map((row) => <article key={row.key}><Star /><span>{row.label}</span><strong>{avg(data.ratings, `${row.key}_score`)}/100</strong><small>{row.description}</small></article>)}
        </section>

        <CleanSection title="גנים לפי עדיפות פיקוח" subtitle="הציון הנמוך ביותר מופיע ראשון.">
          {data.ratings.length === 0 ? <EmptyState title="אין דירוגים להצגה" text="לאחר חישוב הדירוגים, הגנים המשויכים יופיעו כאן." /> : <div className="rating-table">{data.ratings.map((rating: any) => <Link className="rating-row" href={`/dashboard/inspector/inspections?garden=${rating.garden_id}`} key={rating.id}><div><strong>{rating.gardens?.name ?? "גן"}</strong><span>{rating.gardens?.city ?? ""} · {ratingBandLabel(rating.rating_band)} · {ratingTrendLabel(rating.trend)}</span></div><StatusBadge tone={ratingTone(rating.overall_score)}>{rating.overall_score}/100</StatusBadge></Link>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><TrendingDown size={20} /> בירידה או נמוך</h2>{declining.length === 0 ? <div className="empty-mini">אין גנים בירידה.</div> : declining.slice(0, 8).map((rating: any) => <div className="list-item" key={rating.id}><div><strong>{rating.gardens?.name ?? "גן"}</strong><span>בטיחות {rating.safety_score} · פיקוח {rating.inspection_score}</span></div><StatusBadge tone={ratingTone(rating.overall_score)}>{rating.overall_score}/100</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><AlertTriangle size={20} /> המלצות לפעולה</h2>{data.recommendations.length === 0 ? <div className="empty-mini">אין המלצות פתוחות.</div> : data.recommendations.slice(0, 8).map((rec: any) => <div className="list-item" key={rec.id}><div><strong>{rec.title}</strong><span>{rec.gardens?.name ?? "גן"} · {rec.category}</span></div><StatusBadge tone={rec.impact_level === "high" ? "bad" : "warn"}>{rec.impact_level}</StatusBadge></div>)}</article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="ביקורות" text="תכנון וביצוע" href="/dashboard/inspector/inspections/due" icon={ClipboardCheck} />
          <ActionCard title="ליקויים" text="סגירה ואימות" href="/dashboard/inspector/violations" icon={ShieldCheck} />
          <ActionCard title="ציות" text="מסמכים וממצאים" href="/dashboard/inspector/compliance" icon={Star} />
        </section>
      </div>
    </DashboardShell>
  );
}
