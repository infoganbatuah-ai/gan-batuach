import Link from "next/link";
import { UniversalCameraOnboarding } from "@/components/digital-observer/universal-camera-onboarding";
import { ObserverCameraWizard } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { GatewayEnrollmentPanel } from "@/components/digital-observer/gateway-enrollment-panel";
import { CameraOnboardingStatus, type CameraOnboardingSource } from "@/components/digital-observer/camera-onboarding-status";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { hasCurrentObserverAdmin } from "@/lib/domain/digital-observer/admin-access";
import { loadObserverRuntime, observerModeForSite, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ site?: string; gateway_enrollment?: string; new_camera?: string; reassess?: string; advanced?: string; install_intent?: string }> };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export default async function DigitalObserverAddCameraPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const siteId = typeof params?.site === "string" && uuid.test(params.site) ? params.site : undefined;
  const intent = siteId && typeof params?.install_intent === "string" && uuid.test(params.install_intent)
    ? params.install_intent : undefined;
  const addPath = "/digital-observer/cameras/add";
  const next = intent && siteId ? `${addPath}?${new URLSearchParams({ site: siteId, install_intent: intent })}` : addPath;
  const { profile, user } = await requireDigitalObserverUser(`/digital-observer/login?${new URLSearchParams({ next })}`);
  const observerAdmin = params?.advanced === "1" && await hasCurrentObserverAdmin(user.id);
  const runtime = await loadObserverRuntime(profile.id);
  const selected = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  const resumeIntent = selected?.id === siteId ? intent : undefined;
  const mode = observerModeForSite(selected);
  const existingSource = selected && params?.reassess
    ? runtime.cameras.find(camera => camera.observer_site_id === selected.id && camera.id === params.reassess)
    : null;
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/cameras" title="הוספת מצלמות" desktopTitle="תצפיתן דיגיטלי" statusLabel="חיבור מצלמות" flowBackHref={selected ? `/digital-observer/cameras?site=${selected.id}` : "/digital-observer/cameras"}>
    <div className="do-page-stack do-camera-add-page">
      {selected && existingSource ? <CameraOnboardingStatus observerSiteId={selected.id} source={existingSource as unknown as CameraOnboardingSource} /> : null}
      {selected && params?.gateway_enrollment ? <GatewayEnrollmentPanel enrollmentId={params.gateway_enrollment} siteId={selected.id} /> : runtime.sites.length ? params?.advanced === "1" && observerAdmin ? <ObserverCameraWizard sites={runtime.sites} initialSiteId={selected?.id} /> : <UniversalCameraOnboarding sites={runtime.sites.map(site => ({ id: site.id, name: site.name }))} initialSiteId={selected?.id} initialIntent={resumeIntent} /> : <section className="do-empty"><strong>תחילה יש להקים בית או עסק</strong><Link className="do-button primary" href="/digital-observer/onboarding">הקמת אתר</Link></section>}
    </div>
  </ObserverAppShell>;
}
