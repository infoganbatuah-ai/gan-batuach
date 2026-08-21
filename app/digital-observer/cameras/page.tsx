import Link from "next/link";
import { Camera, CameraOff, CircleDot, LockKeyhole, Plus, ServerCog, ShieldCheck, Wifi } from "lucide-react";
import { ObserverQuickAction } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { formatObserverDate, loadObserverRuntime, observerModeForSite, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ camera?: string; site?: string }> };

function sceneFor(index: number, mode: "home" | "business") {
  const scenes = mode === "home" ? ["home-entry", "home-living", "home-nursery", "home-yard"] : ["business-entry", "business-store", "business-warehouse", "business-office", "business-parking", "business-loading"];
  return scenes[index % scenes.length];
}

export default async function DigitalObserverCamerasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/cameras");
  const runtime = await loadObserverRuntime(profile.id);
  const site = runtime.sites.find((item) => item.id === params?.site) ?? runtime.sites[0] ?? null;
  const mode = observerModeForSite(site);
  const cameras = site ? runtime.cameras.filter((item) => item.observer_site_id === site.id) : [];
  const selected = cameras.find((item) => item.id === params?.camera) ?? cameras[0] ?? null;
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/cameras" title={mode === "home" ? "צפייה ומצלמות" : "מצלמות"} statusLabel="ללא חשיפת RTSP" actions={<Link className="do-button primary" href={site ? `/digital-observer/cameras/add?site=${site.id}` : "/digital-observer/onboarding"}><Plus /> הוספת מצלמה</Link>}>
    <div className="do-page-stack">
      {!runtime.runtimeMigrationApplied ? <div className="do-notice warn"><ServerCog /><span>טבלת מקורות המצלמה החדשה עדיין אינה זמינה בסביבה. אין אפשרות ליצור חיבור עד החלת המיגרציה.</span></div> : null}
      <section className="do-section">
        <div className="do-section-head"><div><h2>{site?.name ?? "המצלמות שלי"}</h2><p>תמונה מוצגת כתצוגת הדגמה רק כשהמקור מסומן כך. וידאו חי דורש Gateway וטוקן קצר.</p></div>{site ? <span className="do-badge info">{cameras.length} מקורות</span> : null}</div>
        {cameras.length ? <div className="do-camera-grid">{cameras.map((camera, index) => <Link href={`/digital-observer/cameras?site=${site?.id}&camera=${camera.id}`} key={camera.id}><ObserverCameraMedia name={camera.display_name || "מצלמה"} mode={mode} scene={camera.preview_scene || sceneFor(index, mode)} status={camera.status || camera.health_status} sourceMode={camera.source_mode} /></Link>)}</div> : <div className="do-empty"><CameraOff /><strong>אין מצלמות מחוברות</strong><span>הוסיפו מקור הדמיה או הגדירו מקור שממתין ל-Gateway. אין צורך להזין סודות בדפדפן.</span><Link className="do-button primary" href={site ? `/digital-observer/cameras/add?site=${site.id}` : "/digital-observer/onboarding"}>הוספת מצלמה</Link></div>}
      </section>
      {selected ? <section className="do-grid cols-2">
        <article className="do-panel"><ObserverCameraMedia large name={selected.display_name} mode={mode} scene={selected.preview_scene || sceneFor(cameras.indexOf(selected), mode)} status={selected.status || selected.health_status} sourceMode={selected.source_mode} /><div className="do-camera-readiness-actions"><div><CircleDot /><span><strong>צפייה חיה</strong><small>תיפתח לאחר Gateway וטוקן צפייה קצר</small></span></div><div><Camera /><span><strong>צילום תמונה</strong><small>זמין רק ממקור וידאו מחובר</small></span></div><div><Wifi /><span><strong>שמע</strong><small>כבוי ואינו חלק מהפיילוט הנוכחי</small></span></div></div></article>
        <article className="do-panel do-form-section"><h2>פרטי מקור</h2><div className="do-summary-list"><div><span>סוג חיבור</span><strong>{observerStatusLabel(selected.connector_type)}</strong></div><div><span>מצב</span><strong>{observerStatusLabel(selected.status)}</strong></div><div><span>בריאות</span><strong>{observerStatusLabel(selected.health_status)}</strong></div><div><span>בדיקה אחרונה</span><strong>{formatObserverDate(selected.last_health_check_at)}</strong></div><div><span>מיקום</span><strong>{selected.location_label || "טרם הוגדר"}</strong></div><div><span>וידאו חי</span><strong>{selected.source_mode === "live" ? "דורש אימות Gateway" : "לא פעיל"}</strong></div></div><div className="do-notice info"><LockKeyhole /><span>כתובת המקור, שם המשתמש, הסיסמה ו-secret reference אינם נשלחים לדפדפן.</span></div><div className="do-button-row"><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "test_readiness", id: selected.id }}><ShieldCheck /> בדיקת מוכנות</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/cameras" body={{ action: "disable", id: selected.id }} confirmText="להשבית את מקור המצלמה?"><CameraOff /> השבתה</ObserverQuickAction></div></article>
      </section> : null}
      <section className="do-grid cols-3"><article className="do-panel"><Camera /><h3>IP / ONVIF</h3><p>המחבר מוכן; איתור וחיבור אמיתי דורשים Gateway ברשת המקומית.</p></article><article className="do-panel"><ServerCog /><h3>NVR / DVR</h3><p>מקור אחד יכול לייצג מערכת ולהתרחב לערוצי מצלמה לאחר בדיקת תאימות.</p></article><article className="do-panel"><ShieldCheck /><h3>ענן / Edge</h3><p>ספקים מתווספים דרך מחבר נפרד, ללא קוד קשיח בממשק.</p></article></section>
    </div>
  </ObserverAppShell>;
}
