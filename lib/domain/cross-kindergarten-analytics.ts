export type AnalyticsTone = "good" | "warn" | "bad";

export function analyticsTone(value: number | string, inverse = false): AnalyticsTone {
  if (typeof value === "number") {
    const score = inverse ? 100 - value : value;
    if (score >= 80) return "good";
    if (score >= 58) return "warn";
    return "bad";
  }
  const normalized = value.toLowerCase();
  if (["critical", "high", "rising", "failed", "bad"].includes(normalized)) return "bad";
  if (["medium", "pending", "partial", "warn", "stable"].includes(normalized)) return "warn";
  return "good";
}

export function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row?.[key] ?? 0)).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function percentileRank(value: number, values: number[]) {
  const clean = values.filter((item) => Number.isFinite(item)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const belowOrEqual = clean.filter((item) => item <= value).length;
  return Math.round((belowOrEqual / clean.length) * 100);
}

export function groupByRegion(gardens: any[], profiles: any[] = []) {
  const profileByGarden = new Map(profiles.map((profile) => [profile.garden_id ?? profile.kindergarten_id, profile]));
  const regions = gardens.reduce<Record<string, any>>((acc, garden) => {
    const key = garden.region ?? garden.city ?? "אזור לא צוין";
    acc[key] ??= {
      region: key,
      gardens: 0,
      activeGardens: 0,
      children: 0,
      staff: 0,
      safetyTotal: 0,
      complianceTotal: 0,
      inspectionTotal: 0,
      observerTotal: 0,
      scored: 0
    };
    const profile = profileByGarden.get(garden.id) ?? {};
    acc[key].gardens += 1;
    if (["active", "safe", "approved"].includes(String(garden.status))) acc[key].activeGardens += 1;
    acc[key].children += Number(garden.current_children_count ?? 0);
    acc[key].staff += Number(garden.staff_count ?? 0);
    if (profile.overall_score || profile.safety_score || profile.compliance_score) {
      acc[key].safetyTotal += Number(profile.safety_score ?? 0);
      acc[key].complianceTotal += Number(profile.compliance_score ?? 0);
      acc[key].inspectionTotal += Number(profile.inspection_score ?? 0);
      acc[key].observerTotal += Number(profile.observer_score ?? 0);
      acc[key].scored += 1;
    }
    return acc;
  }, {});
  return Object.values(regions).map((region) => ({
    ...region,
    safetyScore: region.scored ? Math.round(region.safetyTotal / region.scored) : 0,
    complianceScore: region.scored ? Math.round(region.complianceTotal / region.scored) : 0,
    inspectionScore: region.scored ? Math.round(region.inspectionTotal / region.scored) : 0,
    observerScore: region.scored ? Math.round(region.observerTotal / region.scored) : 0
  })).sort((a, b) => b.activeGardens - a.activeGardens);
}

export function benchmarkRows(profiles: any[], gardens: any[], engagementByGarden: Record<string, number>, staffCompletionByGarden: Record<string, number>) {
  const scores = profiles.map((profile) => Number(profile.overall_score ?? 0)).filter(Boolean);
  const gardenById = new Map(gardens.map((garden) => [garden.id, garden]));
  const nationalAverage = avg(profiles, "overall_score");
  return profiles.map((profile) => {
    const gardenId = profile.garden_id ?? profile.kindergarten_id;
    const garden = gardenById.get(gardenId) ?? {};
    const overall = Number(profile.overall_score ?? 0);
    return {
      ...profile,
      garden,
      nationalAverage,
      percentile: percentileRank(overall, scores),
      parentEngagement: engagementByGarden[gardenId] ?? 0,
      staffCompletion: staffCompletionByGarden[gardenId] ?? 0
    };
  }).sort((a, b) => Number(b.overall_score ?? 0) - Number(a.overall_score ?? 0));
}

export function buildAnalyticsInsights(input: {
  regions: any[];
  ratingProfiles: any[];
  risks: any[];
  complaintsThisMonth: number;
  complaintsLastMonth: number;
  inspectionsCompleted: number;
  inspectionsOpen: number;
}) {
  const insights: string[] = [];
  const improvedRegion = [...input.regions].sort((a, b) => Number(b.complianceScore ?? 0) - Number(a.complianceScore ?? 0))[0];
  if (improvedRegion?.complianceScore) insights.push(`${improvedRegion.region} מוביל/ה בציות עם ${improvedRegion.complianceScore}/100 לפי הנתונים הקיימים.`);
  if (input.complaintsLastMonth > 0) {
    const change = Math.round(((input.complaintsThisMonth - input.complaintsLastMonth) / input.complaintsLastMonth) * 100);
    insights.push(change <= 0 ? `נפח הפניות ירד ב-${Math.abs(change)}% לעומת החודש הקודם.` : `נפח הפניות עלה ב-${change}% לעומת החודש הקודם ודורש בדיקה.`);
  }
  if (input.inspectionsCompleted || input.inspectionsOpen) {
    insights.push(`קצב סגירת פיקוח עומד על ${pct(input.inspectionsCompleted, input.inspectionsCompleted + input.inspectionsOpen)}% בתקופה הנוכחית.`);
  }
  const risingRisk = input.risks.filter((risk) => risk.risk_trend === "rising" || ["high", "critical"].includes(String(risk.risk_level))).length;
  if (risingRisk) insights.push(`${risingRisk} גנים מסומנים במגמת סיכון או רמת סיכון גבוהה. נדרשת בדיקה אנושית.`);
  if (!insights.length) insights.push("אין כרגע תובנה חריגה. הנתונים מוצגים כמגמות אגרגטיביות בלבד.");
  return insights;
}

export const analyticsGovernanceRules = [
  "אין הצגת מידע אישי של ילדים או הורים.",
  "השוואות מוצגות ברמת גן, עיר, אזור או מדד מצטבר.",
  "דירוגים וסיכונים הם כלי ניהולי ולא החלטה אוטומטית.",
  "תובנות AI חייבות להתבסס על נתונים קיימים בלבד.",
  "פרסום ציבורי עתידי דורש סינון ואישור נוסף."
] as const;
