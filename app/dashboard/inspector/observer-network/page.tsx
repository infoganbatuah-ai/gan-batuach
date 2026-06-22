import Link from "next/link";
import { AlertTriangle, Camera, ClipboardCheck, Eye, Radar, ShieldCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildObserverReadinessScore, observerNetworkTone, safeObserverRecommendations } from "@/lib/domain/observer-network";
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

function toTone(value?: string | number | null) {
  const tone = observerNetworkTone(value as any);
  return tone === "bad" ? "danger" : tone === "warn" ? "warning" : tone === "good" ? "success" : "primary";
}

export default async function InspectorObserverNetworkPage() {
  const { profile } = await requireRole(["inspector"]);
  const result = await safeAdminData("inspector observer network", async () => {
    const supabase = await createClient();
    const [inspectorRes, gardensRes] = await Promise.all([
      supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
      supabase.from("gardens" as any).select("id,name,city,last_inspection_score,safe_status").eq("inspector_id", profile.id).order("name")
    ]);
    logSupabaseError("inspector observer network gardens", gardensRes.error);
    const gardens = (gardensRes.data ?? []) as any[];
    const gardenIds = gardens.map((garden) => garden.id);
    const [signalsRes, recommendationsRes, camerasRes, reviewsRes] = gardenIds.length ? await Promise.all([
      supabase.from("observer_intelligence_signals" as any).select("id,signal_type,source_type,kindergarten_id,severity,confidence,review_status,recommended_action,risk_score,pattern_key,repeated_count,created_at,gardens(name,city)").in("kindergarten_id", gardenIds).in("review_status", ["needs_review", "reviewing", "escalated"]).order("risk_score", { ascending: false }).limit(120),
      supabase.from("observer_safety_recommendations" as any).select("id,signal_id,kindergarten_id,recommendation_type,recommendation_text,status,created_at,gardens(name,city)").in("kindergarten_id", gardenIds).eq("status", "open").order("created_at", { ascending: false }).limit(80),
      supabase.from("camera_streams" as any).select("id,garden_id,kindergarten_id,status,stream_status,health_status,active").or(`garden_id.in.(${gardenIds.join(",")}),kindergarten_id.in.(${gardenIds.join(",")})`).limit(600),
      supabase.from("observer_signal_reviews" as any).select("id,signal_id,review_status,created_at").order("created_at", { ascending: false }).limit(120)
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    [signalsRes, recommendationsRes, camerasRes, reviewsRes].forEach((res, index) => logSupabaseError(`inspector observer network ${index}`, (res as any).error));
    const signals = (signalsRes.data ?? []) as any[];
    const recommendations = (recommendationsRes.data ?? []) as any[];
    const cameras = (camerasRes.data ?? []) as any[];
    const reviews = (reviewsRes.data ?? []) as any[];
    const unhealthy = cameras.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway", "unhealthy", "degraded"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status))).length;
    const readiness = buildObserverReadinessScore({
      totalCameras: cameras.length,
      activeCameras: cameras.filter((camera) => camera.active !== false).length,
      unhealthyCameras: unhealthy,
      totalSignals: signals.length,
      reviewedSignals: reviews.length,
      falsePositiveSignals: reviews.filter((review) => review.review_status === "dismissed").length,
      unresolvedSignals: signals.length,
      complianceSignals: signals.filter((signal) => signal.signal_type === "compliance").length
    });
    const highRiskGardens = gardens.map((garden) => {
      const gardenSignals = signals.filter((signal) => signal.kindergarten_id === garden.id);
      const maxRisk = Math.max(0, ...gardenSignals.map((signal) => Number(signal.risk_score ?? 0)));
      return { ...garden, signals: gardenSignals.length, maxRisk };
    }).filter((garden) => garden.signals).sort((a, b) => b.maxRisk - a.maxRisk);

    return { gardens, signals, recommendations, cameras, unhealthy, readiness, highRiskGardens, profilePhoto: (inspectorRes.data as any)?.profile_photo_url ?? null, queryError: [signalsRes.error, recommendationsRes.error].some(Boolean) ? "חלק מנתוני רשת התצפיתן לא נטענו" : null };
  }, {
    gardens: [] as any[],
    signals: [] as any[],
    recommendations: [] as any[],
    cameras: [] as any[],
    unhealthy: 0,
    readiness: buildObserverReadinessScore({ totalCameras: 0, activeCameras: 0, unhealthyCameras: 0, totalSignals: 0, reviewedSignals: 0, falsePositiveSignals: 0, unresolvedSignals: 0, complianceSignals: 0 }),
    highRiskGardens: [] as any[],
    profilePhoto: null as string | null,
    queryError: null as string | null
  });

  const data = result.data;
  const profileForUi = { ...profile, profile_image_url: data.profilePhoto ?? profile.profile_image_url };
  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="רשת תצפיתן" subtitle="מצלמות, סימנים והמלצות לבדיקה אנושית" badge="Observer" backHref="/dashboard/inspector">
      <InspectorHero
        eyebrow="רשת בטיחות"
        title="כל הסימנים בגנים שבאחריותך"
        subtitle="מצלמות, תלונות, אירועים, ציות ודפוסים חוזרים במקום אחד. כל המלצה מחייבת בדיקת פקח לפני פעולה."
        artwork={<Radar />}
        action={<Link className="inspector-action-button" href="/dashboard/inspector/ai-events">תור בדיקה</Link>}
        meta={<><span>{data.gardens.length} גנים משויכים</span><span>בדיקת אדם חובה</span></>}
      />
      <AdminDataError message={result.error ?? data.queryError} />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="גנים משויכים" value={data.gardens.length} hint="בתחום הפיקוח שלך" icon={ShieldCheck} tone="success" />
        <InspectorMetricCard label="דורש בדיקה" value={data.signals.length} hint="סימנים פתוחים" icon={Eye} tone={data.signals.length ? "warning" : "success"} />
        <InspectorMetricCard label="המלצות" value={data.recommendations.length} hint="פתוחות" icon={Radar} tone={data.recommendations.length ? "warning" : "success"} />
        <InspectorMetricCard label="מצלמות לא יציבות" value={data.unhealthy} hint="דורשות טיפול" icon={Camera} tone={data.unhealthy ? "warning" : "success"} />
      </InspectorMetricGrid>

      <InspectorSection title="תור בדיקה" subtitle="המערכת מצביעה על סימנים. הפקח מחליט מה נכון לעשות." icon={Eye}>
        <InspectorList>
          {data.signals.slice(0, 12).map((signal: any) => (
            <InspectorRow
              key={signal.id}
              href="/dashboard/inspector/ai-events"
              title={signal.signal_type === "complaint" ? "תלונה לבדיקה" : signal.signal_type === "camera_health" ? "מצלמה לא יציבה" : signal.signal_type === "compliance" ? "פער ציות" : "אירוע תצפיתן"}
              subtitle={signal.gardens?.name ?? "גן"}
              meta={signal.recommended_action ?? "בדיקה מומלצת"}
              status={<InspectorStatus tone={toTone(100 - Number(signal.risk_score ?? 0))}>{signal.risk_score}/100</InspectorStatus>}
            />
          ))}
          {data.signals.length === 0 ? <InspectorEmpty title="אין סימנים פתוחים" text="כאשר יופיע אירוע בגנים שבאחריותך, הוא יופיע כאן." icon={ShieldCheck} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorSection title="גנים עם סיכון עולה" subtitle="דפוסים חוזרים לפי גן" icon={AlertTriangle}>
        <InspectorList>
          {data.highRiskGardens.slice(0, 8).map((garden: any) => <InspectorRow key={garden.id} title={garden.name} subtitle={garden.city ?? ""} meta={`${garden.signals} סימנים פתוחים`} status={<InspectorStatus tone={toTone(100 - garden.maxRisk)}>{garden.maxRisk}/100</InspectorStatus>} />)}
          {data.highRiskGardens.length === 0 ? <InspectorEmpty title="אין דפוס סיכון חריג" text="אין כרגע גנים עם צבירת סימנים חריגה." icon={ShieldCheck} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorSection title="פעולות מותרות" subtitle="המלצות זהירות בלבד. אין האשמות ואין פעולה אוטומטית." icon={ShieldCheck}>
        <InspectorList>
          {safeObserverRecommendations.map((item) => <InspectorRow key={item} title={item} status={<InspectorStatus tone="success">נאכף</InspectorStatus>} />)}
        </InspectorList>
      </InspectorSection>

      <InspectorActions>
        <InspectorActionCard title="ביקורת המשך" text="תכנון ביקורת" href="/dashboard/inspector/inspections/due" icon={ClipboardCheck} />
        <InspectorActionCard title="התראות תצפיתן" text="בדיקה אנושית" href="/dashboard/inspector/ai-events" icon={Eye} />
        <InspectorActionCard title="ציות" text="פערים ואימות" href="/dashboard/inspector/compliance" icon={ShieldCheck} />
        <InspectorActionCard title="מצלמות" text="יציבות וחיבור" href="/dashboard/inspector/cameras" icon={Camera} />
      </InspectorActions>
    </InspectorAppFrame>
  );
}
