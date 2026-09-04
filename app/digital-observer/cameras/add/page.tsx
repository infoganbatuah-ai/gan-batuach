import { ObserverCameraWizard } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { GatewayEnrollmentPanel } from "@/components/digital-observer/gateway-enrollment-panel";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, observerModeForSite, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ site?: string; gateway_enrollment?: string; new_camera?: string }> };

export default async function DigitalObserverAddCameraPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/cameras/add");
  const runtime = await loadObserverRuntime(profile.id);
  const selected = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  const mode = observerModeForSite(selected);
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/cameras" title="הוספת מצלמה" desktopTitle="תצפיתן דיגיטלי" statusLabel="Gateway מאובטח" flowBackHref="/digital-observer/cameras">
    <div className="do-page-stack do-camera-add-page">
      {selected && params?.gateway_enrollment ? <GatewayEnrollmentPanel enrollmentId={params.gateway_enrollment} siteId={selected.id} /> : selected && runtime.cameras.some(camera => camera.observer_site_id === selected.id) && params?.new_camera !== "1" ? <section className="do-panel"><h2>המצלמות כבר מוגדרות באתר הזה</h2><p>אין צורך להוסיף שוב את ה-DVR או ליצור זהות Gateway חדשה. מצב החיבור של כל ערוץ מוצג ברשימת המצלמות.</p><a className="do-button primary" href={`/digital-observer/cameras?site=${selected.id}`}>למצלמות הקיימות</a><a className="do-button secondary" href={`/digital-observer/cameras/add?site=${selected.id}&new_camera=1`}>הוספת מקור חדש בלבד</a></section> : runtime.sites.length ? <ObserverCameraWizard sites={runtime.sites} initialSiteId={selected?.id} /> : <section className="do-empty"><strong>תחילה יש להקים בית או עסק</strong><a className="do-button primary" href="/digital-observer/onboarding">הקמת אתר</a></section>}
    </div>
  </ObserverAppShell>;
}
