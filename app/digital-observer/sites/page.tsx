import Link from "next/link";
import { Bell, Building2, Camera, MapPin, Plus, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { ObserverCameraMedia } from "@/components/digital-observer/observer-camera-media";
import { requireUser } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { loadObserverRuntime, observerModeForSite, observerStatusLabel } from "@/lib/domain/digital-observer/runtime";

export default async function DigitalObserverSitesPage() {
  const { profile } = await requireUser("/digital-observer/login?next=/digital-observer/sites"); const runtime = await loadObserverRuntime(profile.id); const primary = runtime.sites[0] ?? null; const mode = observerModeForSite(primary);
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/sites" title="אתרים" statusLabel="הפרדת לקוחות ואתרים" actions={<Link className="do-button primary" href="/digital-observer/onboarding?type=business"><Plus /> אתר חדש</Link>}><div className="do-page-stack">
    <div className="do-section-head"><div><h2>האתרים שלי</h2><p>כל אתר הוא תחום הרשאות נפרד עם מצלמות, אירועים וכללי ניטור משלו.</p></div><span className="do-badge info">{runtime.sites.length} אתרים</span></div>
    {runtime.sites.length ? <section className="do-site-grid">{runtime.sites.map((site,index) => { const cameras = runtime.cameras.filter((item) => item.observer_site_id === site.id); const signals = runtime.signals.filter((item) => item.observer_site_id === site.id && ["needs_review","reviewing","escalated"].includes(item.review_status)); const siteMode = observerModeForSite(site); return <article className="do-site-card" key={site.id}><ObserverCameraMedia name={cleanSyntheticLabel(site.name,"אתר")} mode={siteMode} scene={siteMode === "home" ? `home-${["entry","living","yard"][index%3]}` : `business-${["entry","store","office"][index%3]}`} status={cameras.some((item) => ["connected","healthy","online"].includes(item.status || item.health_status)) ? "healthy" : "readiness"} /><div className="do-site-body"><h2>{cleanSyntheticLabel(site.name,"אתר")}</h2><p><MapPin /> {site.address || "כתובת טרם הוגדרה"}</p><div className="do-site-stats"><span><Camera /><b>{cameras.length}</b> מצלמות</span><span><Bell /><b>{signals.length}</b> פתוחים</span><span><ShieldCheck /><b>{observerStatusLabel(site.observer_subscription_status)}</b></span></div><Link className="do-button secondary full" href={`/digital-observer/dashboard?site=${site.id}`}>פתיחת האתר</Link></div></article>; })}</section> : <div className="do-empty"><Building2 /><strong>עדיין אין אתרים</strong><span>הקימו בית או עסק עם מידע סינתטי ומצב מוכנות בטוח.</span><Link className="do-button primary" href="/digital-observer/onboarding">הקמת אתר ראשון</Link></div>}
    <div className="do-notice info"><ShieldCheck /><span>אתרי התצפיתן אינם גני ילדים ואינם משתפים נתוני הורים/ילדים. חיבור עתידי לגן בטוח יתבצע דרך API מאובטח ומבוקר.</span></div>
  </div></ObserverAppShell>;
}
