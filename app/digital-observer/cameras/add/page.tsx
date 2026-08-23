import { ObserverCameraWizard } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, observerModeForSite } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ site?: string }> };

export default async function DigitalObserverAddCameraPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/cameras/add");
  const runtime = await loadObserverRuntime(profile.id);
  const selected = runtime.sites.find((site) => site.id === params?.site) ?? runtime.sites[0];
  const mode = observerModeForSite(selected);
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/cameras" title="הוספת מצלמה" desktopTitle="תצפיתן דיגיטלי" statusLabel="Gateway מאובטח" flowBackHref="/digital-observer/cameras">
    <div className="do-page-stack do-camera-add-page">
      {runtime.sites.length ? <ObserverCameraWizard sites={runtime.sites} initialSiteId={selected?.id} /> : <section className="do-empty"><strong>תחילה יש להקים בית או עסק</strong><a className="do-button primary" href="/digital-observer/onboarding">הקמת אתר</a></section>}
    </div>
  </ObserverAppShell>;
}
