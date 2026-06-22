import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Eye, ShieldCheck, TrendingUp } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { predictiveRiskSafeguards, riskCategoryRows, riskLevelLabel, riskTone, riskTrendLabel } from "@/lib/domain/predictive-risk";
import { preventionTone, warningTypeLabel } from "@/lib/domain/predictive-safety-prevention";
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
  InspectorSection,
  InspectorStatus
} from "@/components/inspector-app-ui";

function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row[key] ?? 0));
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function toTone(value?: string | number | null) {
  const tone = riskTone(value as any);
  return tone === "bad" ? "danger" : tone === "warn" ? "warning" : tone === "good" ? "success" : "primary";
}

function preventionToTone(value?: string | null) {
  const tone = preventionTone(value ?? "");
  return tone === "bad" ? "danger" : tone === "warn" ? "warning" : tone === "good" ? "success" : "primary";
}

export default async function InspectorRiskPage() {
  const { profile } = await requireRole(["inspector"]);
  const result = await safeAdminData("inspector risk", async () => {
    const supabase = await createClient();
    const [inspectorRes, gardensRes] = await Promise.all([
      supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
      supabase.from("gardens" as any).select("id,name,city").eq("inspector_id", profile.id).order("name")
    ]);
    logSupabaseError("inspector risk gardens", gardensRes.error);
    const gardens = (gardensRes.data ?? []) as any[];
    const gardenIds = gardens.map((garden) => garden.id);
    const [profilesRes, signalsRes, recsRes, warningsRes, actionsRes] = gardenIds.length ? await Promise.all([
      supabase.from("kindergarten_risk_profiles" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).order("overall_risk_score", { ascending: false }).limit(200),
      supabase.from("predictive_risk_signals" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).in("review_status", ["needs_review", "reviewing", "escalated"]).order("created_at", { ascending: false }).limit(120),
      supabase.from("risk_prevention_recommendations" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).eq("status", "open").order("created_at", { ascending: false }).limit(120),
      supabase.from("early_warning_signals" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).in("review_status", ["needs_review", "reviewing", "confirmed", "escalated"]).order("created_at", { ascending: false }).limit(120),
      supabase.from("prevention_recommendation_actions" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).in("status", ["open", "in_progress", "approved"]).order("created_at", { ascending: false }).limit(120)
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    [profilesRes, signalsRes, recsRes, warningsRes, actionsRes].forEach((query, index) => logSupabaseError(`inspector risk query ${index}`, (query as any).error));
    return {
      gardens,
      profiles: (profilesRes.data ?? []) as any[],
      signals: (signalsRes.data ?? []) as any[],
      recommendations: (recsRes.data ?? []) as any[],
      warnings: (warningsRes.data ?? []) as any[],
      actions: (actionsRes.data ?? []) as any[],
      profilePhoto: (inspectorRes.data as any)?.profile_photo_url ?? null,
      queryError: profilesRes.error ? "חלק מנתוני הסיכון לא נטענו" : null
    };
  }, { gardens: [] as any[], profiles: [] as any[], signals: [] as any[], recommendations: [] as any[], warnings: [] as any[], actions: [] as any[], profilePhoto: null as string | null, queryError: null as string | null });

  const data = result.data;
  const profileForUi = { ...profile, profile_image_url: data.profilePhoto ?? profile.profile_image_url };
  const average = avg(data.profiles, "overall_risk_score");
  const highRisk = data.profiles.filter((item) => ["high", "critical"].includes(String(item.risk_level)));
  const rising = data.profiles.filter((item) => item.risk_trend === "rising");
  const sample = data.profiles[0] ?? {};

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="מודיעין סיכון" subtitle="תיעדוף ביקורות לפי דפוסי סיכון" badge="סיכון" backHref="/dashboard/inspector">
      <InspectorHero
        eyebrow="סיכון מונע"
        title="איפה צריך לבדוק קודם"
        subtitle="דפוסים חוזרים, סיכון עולה והמלצות מניעה. אין אכיפה אוטומטית, פקח מאשר כל פעולה."
        artwork={<TrendingUp />}
        action={<Link className="inspector-action-button" href="/dashboard/inspector/inspections/due">ביקורות קרובות</Link>}
        meta={<><span>{data.gardens.length} גנים</span><span>{highRisk.length} בסיכון גבוה</span></>}
      />
      <AdminDataError message={result.error ?? data.queryError} />
      <InspectorMetricGrid columns={5}>
        <InspectorMetricCard label="סיכון ממוצע" value={`${average}/100`} hint="ציון כללי" icon={TrendingUp} tone={toTone(average)} />
        <InspectorMetricCard label="סיכון גבוה" value={highRisk.length} hint="דורש תשומת לב" icon={AlertTriangle} tone={highRisk.length ? "danger" : "success"} />
        <InspectorMetricCard label="סיכון עולה" value={rising.length} hint="מגמה" icon={TrendingUp} tone={rising.length ? "warning" : "success"} />
        <InspectorMetricCard label="אזהרות" value={data.warnings.length} hint="מוקדמות" icon={AlertTriangle} tone={data.warnings.length ? "warning" : "success"} />
        <InspectorMetricCard label="המלצות" value={data.recommendations.length + data.actions.length} hint="פתוחות" icon={ShieldCheck} tone={data.recommendations.length || data.actions.length ? "warning" : "success"} />
      </InspectorMetricGrid>

      <InspectorSection title="קטגוריות סיכון" subtitle="ממוצע מתוך הגנים המשויכים" icon={ShieldCheck}>
        <InspectorMetricGrid columns={5}>
          {riskCategoryRows(sample).map((row) => <InspectorMetricCard key={row.key} label={row.label} value={`${avg(data.profiles, `${row.key}_risk`)}/100`} hint={row.description} icon={AlertTriangle} tone={toTone(avg(data.profiles, `${row.key}_risk`))} />)}
        </InspectorMetricGrid>
      </InspectorSection>

      <InspectorSection title="תיעדוף גנים" subtitle="הסיכון הגבוה ביותר מופיע ראשון" icon={TrendingUp}>
        <InspectorList>
          {data.profiles.map((risk) => (
            <InspectorRow
              key={risk.id}
              href={`/dashboard/inspector/inspections?garden=${risk.garden_id}`}
              title={risk.gardens?.name ?? "גן"}
              subtitle={risk.gardens?.city ?? ""}
              meta={`${riskTrendLabel(risk.risk_trend)} · חזוי ${riskLevelLabel(risk.predicted_risk_level)}`}
              status={<InspectorStatus tone={toTone(risk.overall_risk_score)}>{risk.overall_risk_score}/100</InspectorStatus>}
            />
          ))}
          {data.profiles.length === 0 ? <InspectorEmpty title="אין פרופילי סיכון להצגה" text="כאשר יהיו נתוני סיכון בגנים המשויכים, הם יופיעו כאן." icon={ShieldCheck} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorSection title="המלצות ואזהרות" subtitle="פעולות לבדיקת פקח" icon={AlertTriangle}>
        <InspectorList>
          {data.actions.slice(0, 8).map((rec) => <InspectorRow key={rec.id} title={rec.title} subtitle={rec.gardens?.name ?? "גן"} meta={rec.description} status={<InspectorStatus tone={preventionToTone(rec.priority)}>{rec.priority}</InspectorStatus>} />)}
          {data.recommendations.slice(0, 8).map((rec) => <InspectorRow key={rec.id} title={rec.title} subtitle={rec.gardens?.name ?? "גן"} meta={rec.explanation} status={<InspectorStatus tone={toTone(rec.priority)}>{rec.priority}</InspectorStatus>} />)}
          {data.warnings.slice(0, 8).map((warning) => <InspectorRow key={warning.id} title={warningTypeLabel(warning.warning_type)} subtitle={warning.gardens?.name ?? "גן"} meta={warning.recommended_action} status={<InspectorStatus tone={preventionToTone(warning.severity)}>{warning.confidence_score}%</InspectorStatus>} />)}
          {data.actions.length + data.recommendations.length + data.warnings.length === 0 ? <InspectorEmpty title="אין המלצות פתוחות" text="כאשר תופיע המלצת מניעה או אזהרה מוקדמת, היא תוצג כאן." icon={ShieldCheck} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorSection title="גבולות בטיחות" subtitle="המערכת ממליצה, אדם מחליט" icon={ShieldCheck}>
        <InspectorList>
          {predictiveRiskSafeguards.map((item) => <InspectorRow key={item} title={item} status={<InspectorStatus tone="success">נאכף</InspectorStatus>} />)}
        </InspectorList>
      </InspectorSection>

      <InspectorActions>
        <InspectorActionCard title="ביקורת המשך" text="תכנון וביצוע" href="/dashboard/inspector/inspections/due" icon={ClipboardCheck} />
        <InspectorActionCard title="רשת תצפיתן" text="סימנים חוזרים" href="/dashboard/inspector/observer-network" icon={Eye} />
        <InspectorActionCard title="ציות" text="פערים ואימות" href="/dashboard/inspector/compliance" icon={ShieldCheck} />
      </InspectorActions>
    </InspectorAppFrame>
  );
}
