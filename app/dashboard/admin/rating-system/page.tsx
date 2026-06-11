import Link from "next/link";
import { Award, BarChart3, Building2, Eye, LineChart, ShieldCheck, Star, TrendingDown } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { categoryScoreRows, publicRatingBoundary, ratingBandLabel, ratingTone, ratingTrendLabel, ratingWeights } from "@/lib/domain/kindergarten-rating";

function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row[key] ?? 0)).filter((value) => value > 0);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function groupRegional(rows: any[]) {
  const map = rows.reduce<Record<string, { city: string; count: number; total: number; low: number }>>((acc, row) => {
    const city = row.gardens?.city ?? "אזור לא צוין";
    acc[city] ??= { city, count: 0, total: 0, low: 0 };
    acc[city].count += 1;
    acc[city].total += Number(row.overall_score ?? 0);
    if (Number(row.overall_score ?? 0) < 65) acc[city].low += 1;
    return acc;
  }, {});
  return Object.values(map).map((item) => ({ ...item, score: item.count ? Math.round(item.total / item.count) : 0 })).sort((a, b) => b.score - a.score);
}

export default async function AdminRatingSystemPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("national kindergarten rating", async () => {
    const supabase = await createClient();
    const [profilesRes, historyRes, recommendationsRes] = await Promise.all([
      supabase.from("kindergarten_rating_profiles" as any).select("*, gardens(id,name,city,status,safe_status,last_inspection_score)").order("overall_score", { ascending: false }).limit(500),
      supabase.from("kindergarten_rating_history" as any).select("garden_id,snapshot_date,snapshot_period,overall_score,safety_score,compliance_score,inspection_score,parent_satisfaction_score,observer_score").eq("snapshot_period", "daily").order("snapshot_date", { ascending: false }).limit(1200),
      supabase.from("kindergarten_rating_recommendations" as any).select("id,garden_id,category,title,impact_level,status,gardens(name,city)").eq("status", "open").order("impact_level", { ascending: false }).limit(200)
    ]);
    [profilesRes, historyRes, recommendationsRes].forEach((query, index) => logSupabaseError(`rating system query ${index}`, (query as any).error));
    const profiles = (profilesRes.data ?? []) as any[];
    const history = (historyRes.data ?? []) as any[];
    const recommendations = (recommendationsRes.data ?? []) as any[];
    const nationalAverage = avg(profiles, "overall_score");
    const topRated = profiles.slice(0, 8);
    const lowestRated = [...profiles].sort((a, b) => Number(a.overall_score ?? 0) - Number(b.overall_score ?? 0)).slice(0, 8);
    const recentHistory = history.slice(0, 30);
    const trendAverage = avg(recentHistory, "overall_score");
    const regional = groupRegional(profiles);
    return { profiles, history, recommendations, nationalAverage, topRated, lowestRated, regional, trendAverage, queryError: [profilesRes.error, recommendationsRes.error].some(Boolean) ? "חלק מנתוני הדירוג לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null };
  }, { profiles: [] as any[], history: [] as any[], recommendations: [] as any[], nationalAverage: 0, topRated: [] as any[], lowestRated: [] as any[], regional: [] as any[], trendAverage: 0, queryError: null as string | null });

  const data = result.data;
  const sample = data.profiles[0] ?? {};
  return (
    <DashboardShell role="admin" title="מערכת דירוג">
      <div className="commercial-dashboard rating-system-shell">
        <PremiumDashboardHero eyebrow="National Rating" title="מערכת הדירוג הרשמית של גן בטוח" subtitle="ציון שקוף ומוסבר לכל גן: בטיחות, ציות, פיקוח, שביעות רצון ותצפיתן. בלי דירוגים נסתרים ובלי קופסה שחורה." badge={`${data.nationalAverage}/100`} badgeTone={ratingTone(data.nationalAverage)} actions={<><Link className="button primary" href="/dashboard/admin/compliance-center">ציות</Link><Link className="button secondary" href="/dashboard/admin/national-inspections">פיקוח</Link></>}>
          <div className="setup-checklist"><span>משקלים גלויים</span><span>הסבר לכל ציון</span><span>פרסום ציבורי כבוי כברירת מחדל</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="ממוצע ארצי" value={`${data.nationalAverage}/100`} tone={ratingTone(data.nationalAverage)} />
          <RoleMetricCard label="גנים מדורגים" value={data.profiles.length} tone="good" />
          <RoleMetricCard label="דורשים תשומת לב" value={data.profiles.filter((profile: any) => Number(profile.overall_score ?? 0) < 65).length} tone={data.profiles.some((profile: any) => Number(profile.overall_score ?? 0) < 65) ? "warn" : "good"} />
          <RoleMetricCard label="המלצות פתוחות" value={data.recommendations.length} tone={data.recommendations.length ? "warn" : "good"} />
        </section>

        <section className="rating-score-grid">
          {categoryScoreRows(sample).map((row) => <article key={row.key}><Star /><span>{row.label}</span><strong>{avg(data.profiles, `${row.key}_score`)}/100</strong><small>{row.description}</small></article>)}
        </section>

        <CleanSection title="משקל הדירוג" subtitle="כך מחושב הציון הכללי. כל קטגוריה גלויה.">
          <div className="rating-weight-grid">{ratingWeights.map((item) => <article key={item.key}><strong>{item.weight}%</strong><span>{item.label}</span></article>)}</div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><Award size={20} /> הגנים המובילים</h2>{data.topRated.length === 0 ? <div className="empty-mini">אין דירוגים להצגה.</div> : data.topRated.map((profile: any) => <div className="list-item" key={profile.id}><div><strong>{profile.gardens?.name ?? "גן"}</strong><span>{profile.gardens?.city ?? ""} · {ratingBandLabel(profile.rating_band)}</span></div><StatusBadge tone={ratingTone(profile.overall_score)}>{profile.overall_score}/100</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><TrendingDown size={20} /> דורשים תשומת לב</h2>{data.lowestRated.length === 0 ? <div className="empty-mini">אין דירוגים להצגה.</div> : data.lowestRated.map((profile: any) => <div className="list-item" key={profile.id}><div><strong>{profile.gardens?.name ?? "גן"}</strong><span>{profile.gardens?.city ?? ""} · {ratingTrendLabel(profile.trend)}</span></div><StatusBadge tone={ratingTone(profile.overall_score)}>{profile.overall_score}/100</StatusBadge></div>)}</article>
        </section>

        <CleanSection title="מגמות אזוריות" subtitle="השוואה לפי עיר או אזור.">
          {data.regional.length === 0 ? <EmptyState title="אין מגמות אזוריות" /> : <div className="rating-table">{data.regional.slice(0, 12).map((region: any) => <div className="rating-row" key={region.city}><div><strong>{region.city}</strong><span>{region.count} גנים · {region.low} דורשים תשומת לב</span></div><StatusBadge tone={ratingTone(region.score)}>{region.score}/100</StatusBadge></div>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><ShieldCheck size={20} /> המלצות שיפור</h2>{data.recommendations.length === 0 ? <div className="empty-mini">אין המלצות פתוחות.</div> : data.recommendations.slice(0, 8).map((rec: any) => <div className="list-item" key={rec.id}><div><strong>{rec.title}</strong><span>{rec.gardens?.name ?? "גן"} · {rec.category}</span></div><StatusBadge tone={rec.impact_level === "high" ? "bad" : "warn"}>{rec.impact_level}</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><Eye size={20} /> גבול ציבורי</h2><div className="setup-checklist">{publicRatingBoundary.map((rule) => <span key={rule}>{rule}</span>)}</div></article>
        </section>

        <CleanSection title="שאלות עוזר דירוג" subtitle="מבוססות נתונים קיימים בלבד.">
          <div className="rating-question-grid">{["למה ציון גן ירד?", "אילו גנים השתפרו הכי הרבה?", "אילו גנים דורשים תשומת לב?", "מה משפר דירוג מהר?"].map((question) => <Link href="/dashboard/admin/rating-system" key={question}>{question}</Link>)}</div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="פיקוח ארצי" text="ממצאים וסגירה" href="/dashboard/admin/national-inspections" icon={ShieldCheck} />
          <ActionCard title="ציות חכם" text="מסמכים ותעודות" href="/dashboard/admin/compliance-center" icon={Building2} />
          <ActionCard title="רשת בטיחות" text="תצפיתן וסיכון" href="/dashboard/admin/observer-network" icon={BarChart3} />
          <ActionCard title="דוחות" text="מגמות והיסטוריה" href="/dashboard/admin/reports" icon={LineChart} />
        </section>
      </div>
    </DashboardShell>
  );
}
