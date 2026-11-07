import { PrivacyComplianceCenter } from "@/components/digital-observer/privacy-compliance-center";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, observerModeForSite, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

export default async function DigitalObserverPrivacyPage({ searchParams }: { searchParams?: Promise<{ site?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/privacy");
  const runtime = await loadObserverRuntime(profile.id);
  const site = selectObserverSite(runtime.sites, runtime.cameras, params.site);
  const mode = observerModeForSite(site);
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/privacy" title="פרטיות וציות" statusLabel="אישור חיצוני ממתין">
    {site ? <PrivacyComplianceCenter siteId={site.id} /> : <div className="do-empty"><strong>נדרש אתר מורשה</strong><span>מרכז הפרטיות נפתח רק בתוך Site שהמשתמש מורשה אליו.</span></div>}
  </ObserverAppShell>;
}
