import Link from "next/link";
import { ClipboardCheck, FileText, ShieldCheck, Star, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { categoryScoreRows, cleanRatingReasons, publicRatingBoundary, ratingBandLabel, ratingTone, ratingTrendLabel, ratingWeights } from "@/lib/domain/kindergarten-rating";

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
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="דירוג הגן">
      <div className="commercial-dashboard rating-system-shell">
        <PremiumDashboardHero eyebrow="Rating" title="דירוג איכות ובטיחות הגן" subtitle="הציון מחושב בשקיפות לפי בטיחות, ציות, פיקוח, שביעות רצון ותצפיתן. אפשר לראות מה משפיע עליו ומה משפר אותו." badge={`${rating.overall_score}/100`} badgeTone={ratingTone(Number(rating.overall_score ?? 0))} actions={<Link className="button primary" href="/dashboard/garden/compliance">שיפור ציות</Link>}>
          <div className="setup-checklist"><span>{ratingBandLabel(rating.rating_band)}</span><span>{ratingTrendLabel(rating.trend)}</span><span>משקלים גלויים</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="ציון כללי" value={`${rating.overall_score}/100`} tone={ratingTone(Number(rating.overall_score ?? 0))} />
          <RoleMetricCard label="בטיחות" value={`${rating.safety_score}/100`} tone={ratingTone(Number(rating.safety_score ?? 0))} />
          <RoleMetricCard label="ציות" value={`${rating.compliance_score}/100`} tone={ratingTone(Number(rating.compliance_score ?? 0))} />
          <RoleMetricCard label="תצפיתן" value={`${rating.observer_score}/100`} tone={ratingTone(Number(rating.observer_score ?? 0))} />
        </section>

        <section className="rating-score-grid">
          {categoryScoreRows(rating).map((row) => <article key={row.key}><Star /><span>{row.label}</span><strong>{row.value}/100</strong><small>{row.description}</small></article>)}
        </section>

        <CleanSection title="איך הציון מחושב" subtitle="המשקלים גלויים, ללא דירוג נסתר.">
          <div className="rating-weight-grid">{ratingWeights.map((item) => <article key={item.key}><strong>{item.weight}%</strong><span>{item.label}</span></article>)}</div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><TrendingUp size={20} /> מה משפיע על הציון</h2>{reasons.length === 0 ? <div className="empty-mini">אין גורמים חריגים שמורידים את הציון.</div> : reasons.map((reason) => <div className="list-item" key={reason}><div><strong>{reason}</strong><span>ניתן לטפל ולשפר</span></div><StatusBadge tone="warn">פתוח</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><ShieldCheck size={20} /> מה משפר את הציון</h2>{improvements.length === 0 ? <div className="empty-mini">אין המלצות זמינות.</div> : improvements.map((item) => <div className="list-item" key={item}><div><strong>{item}</strong><span>פעולה מומלצת</span></div><StatusBadge tone="good">שיפור</StatusBadge></div>)}</article>
        </section>

        <CleanSection title="המלצות פתוחות" subtitle="פעולות שמעלות דירוג בצורה מדידה.">
          {data.recommendations.length === 0 ? <EmptyState title="אין המלצות פתוחות" text="כשהמערכת תזהה פעולה לשיפור, היא תופיע כאן." /> : <div className="rating-table">{data.recommendations.map((rec: any) => <div className="rating-row" key={rec.id}><div><strong>{rec.title}</strong><span>{rec.explanation}</span></div><StatusBadge tone={rec.impact_level === "high" ? "bad" : "warn"}>{rec.impact_level}</StatusBadge></div>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><Star size={20} /> היסטוריה</h2>{data.history.length === 0 ? <div className="empty-mini">אין עדיין היסטוריה.</div> : data.history.slice(0, 8).map((item: any) => <div className="list-item" key={item.id}><div><strong>{new Date(item.snapshot_date).toLocaleDateString("he-IL")}</strong><span>בטיחות {item.safety_score} · ציות {item.compliance_score}</span></div><StatusBadge tone={ratingTone(item.overall_score)}>{item.overall_score}/100</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><ShieldCheck size={20} /> גבול ציבורי</h2><div className="setup-checklist">{publicRatingBoundary.map((rule) => <span key={rule}>{rule}</span>)}</div></article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="ציות" text="מסמכים ותעודות" href="/dashboard/garden/compliance" icon={FileText} />
          <ActionCard title="פיקוח" text="ממצאים וביקורות" href="/dashboard/garden/inspections" icon={ClipboardCheck} />
          <ActionCard title="בטיחות" text="אירועים פתוחים" href="/dashboard/garden/incidents" icon={ShieldCheck} />
        </section>
      </div>
    </DashboardShell>
  );
}
