import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { NaturalLanguageInvestigationSearch } from "@/components/digital-observer/natural-language-investigation-search";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, observerModeForSite, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ site?: string }> };

export default async function DigitalObserverInvestigationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/investigation");
  const runtime = await loadObserverRuntime(profile.id);
  const site = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  const mode = observerModeForSite(site);

  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/investigation" title="חקירת אירועים" statusLabel="חיפוש מבוסס נתוני אמת">
    <div className="do-page-stack">
      <section className="do-panel">
        <div className="do-section-head"><div><h2>חקירה בשפה טבעית</h2><p>שאלו על אירועים שכבר נשמרו במקום לעבור ידנית על שעות של וידאו.</p></div><Search /></div>
        {runtime.sites.length > 1 ? <div className="do-button-row">{runtime.sites.map((item) => <Link className={`do-button ${item.id === site?.id ? "primary" : "secondary"}`} href={`/digital-observer/investigation?site=${item.id}`} key={item.id}>{item.name}</Link>)}</div> : null}
      </section>
      {site ? <NaturalLanguageInvestigationSearch observerSiteId={String(site.id)} siteName={String(site.name)} /> : <div className="do-empty"><ShieldCheck /><strong>תחילה יש להקים אתר מורשה</strong><Link className="do-button primary" href="/digital-observer/onboarding">תחילת הקמה</Link></div>}
    </div>
  </ObserverAppShell>;
}
