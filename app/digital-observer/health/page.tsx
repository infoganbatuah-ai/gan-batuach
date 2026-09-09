import { Activity, AlertTriangle, Camera, CircleDot, ServerCog, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { loadCameraHealthSnapshot } from "@/lib/domain/digital-observer/camera-health-data";
import type { CameraHealthProjection, CameraHealthReason } from "@/lib/domain/digital-observer/camera-health-model";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const labels: Record<string, string> = { HEALTHY: "תקינה", RECOVERING: "מתאוששת", DEGRADED: "דורשת בדיקה", OFFLINE: "לא זמינה", ACTION_REQUIRED: "נדרשת פעולה", EMPTY: "ערוץ פנוי",
  FRAME_STALE: "התמונה אינה מתקדמת", RELAY_FAILED: "חיבור הווידאו נעצר", PLAYBACK_FAILED: "הצפייה החיה אינה זמינה", AI_STALLED: "הניטור החכם דורש בדיקה",
  COMPONENT_OFFLINE: "רכיב החיבור אינו זמין", AUTH_DEGRADED: "נדרשת הרשאה מחדש", CLOUD_UNAVAILABLE: "החיבור לענן זמנית אינו זמין", RESYNC_PENDING: "ממתין לסנכרון", CHANNEL_EMPTY: "ערוץ ללא מצלמה" };

export default async function CameraHealthPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const session = await requireDigitalObserverUser(); const supabase = await createClient(); const requested = (await searchParams).site;
  const siteId = requested || (await supabase.from("observer_sites").select("id").eq("owner_profile_id", session.profile.id).is("garden_id", null).limit(1).maybeSingle()).data?.id;
  if (!siteId) redirect("/digital-observer/onboarding"); const site = await getObserverSiteAccess(supabase, session.profile, siteId); if (!site) redirect("/digital-observer/dashboard");
  const data = await loadCameraHealthSnapshot(siteId);
  return <ObserverAppShell profile={session.profile} mode={site.site_type === "business" ? "business" : "home"} activeHref="/digital-observer/cameras" title="בריאות המצלמות" statusLabel={labels[data.site.summary] || data.site.summary}>
    <div className="do-page-stack"><section className="do-business-summary"><article className="do-metric"><Camera/><strong>{data.site.expectedPhysicalCameras}</strong><span>מצלמות צפויות</span></article><article className="do-metric"><ShieldCheck/><strong>{data.site.healthyExpectedCameras}</strong><span>תקינות כעת</span></article><article className="do-metric"><CircleDot/><strong>{data.site.emptyChannels}</strong><span>ערוצים פנויים</span></article><article className="do-metric"><ServerCog/><strong>{data.components.length}</strong><span>רכיבי חיבור</span></article></section>
    {data.site.commonCauses.map(cause => <section className="do-notice warning" key={cause.dedupeKey}><AlertTriangle/><span>תקלה משותפת ברכיב חיבור משפיעה על {cause.affectedCount} מצלמות. מוצגת סיבה אחת במקום התראות כפולות.</span></section>)}
    <section className="do-panel"><div className="do-section-head"><div><h2>מצב מפורט</h2><p>צפייה חיה, תמונה מתקדמת וניטור חכם נבדקים בנפרד. ערוץ פנוי אינו מצלמה תקולה.</p></div><Activity/></div><div className="do-summary-list">{data.cameras.map((camera: CameraHealthProjection) => <div key={camera.cameraId}><span>{camera.name} · {camera.reasons.length ? camera.reasons.map((reason: CameraHealthReason) => labels[reason] || reason).join(" · ") : "כל הבדיקות הזמינות תקינות"}</span><strong className={`do-badge ${camera.summary === "HEALTHY" ? "good" : camera.summary === "RECOVERING" || camera.summary === "EMPTY" ? "warn" : "bad"}`}>{labels[camera.summary] || camera.summary}</strong></div>)}</div></section></div>
  </ObserverAppShell>;
}
