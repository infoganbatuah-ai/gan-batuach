import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { NaturalLanguageInvestigationSearch } from "@/components/digital-observer/natural-language-investigation-search";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { createDigitalObserverAdminDataClient, requireDigitalObserverAdmin } from "@/lib/domain/digital-observer/admin-access";

type PageProps = { searchParams?: Promise<{ site?: string }> };
type SiteRow = { id: string; name: string };

export default async function DigitalObserverInvestigationAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverAdmin("/digital-observer/admin/investigation");
  const db = createDigitalObserverAdminDataClient();
  const sitesResult = await db.from("observer_sites" as never).select("id,name").is("garden_id", null).neq("site_type", "kindergarten").order("name").limit(500);
  const sites = (sitesResult.data ?? []) as unknown as SiteRow[];
  const selected = sites.find((site) => site.id === params?.site) ?? sites[0] ?? null;

  return <ObserverAppShell profile={profile} mode="admin" activeHref="/digital-observer/admin/investigation" title="בקרת חקירה" statusLabel="שאילתה מוגבלת וניתנת לביקורת">
    <div className="do-page-stack">
      <section className="do-panel">
        <div className="do-section-head"><div><h2>בדיקת פירוש ו-Grounding</h2><p>תוכנית החיפוש, פתרון הישויות, הרשומות התומכות וזמן השאילתה מוצגים למנהל מורשה בלבד.</p></div><Search /></div>
        <div className="do-button-row">{sites.map((site) => <Link className={`do-button ${selected?.id === site.id ? "primary" : "secondary"}`} href={`/digital-observer/admin/investigation?site=${site.id}`} key={site.id}>{site.name}</Link>)}</div>
        <div className="do-notice info"><ShieldCheck /><span>מצב Admin אינו מקנה גישה למדיה. פתיחת קליפ עדיין דורשת הרשאת אתר ומדיה רגילה.</span></div>
      </section>
      {selected ? <NaturalLanguageInvestigationSearch observerSiteId={selected.id} siteName={selected.name} adminMode /> : <div className="do-empty"><ShieldCheck /><strong>אין אתר Digital Observer זמין לחקירה</strong></div>}
    </div>
  </ObserverAppShell>;
}
