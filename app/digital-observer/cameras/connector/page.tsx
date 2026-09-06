import Link from "next/link";
import { Check, Download, LockKeyhole, ServerCog, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, observerModeForSite, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

type PageProps = { searchParams?: Promise<{ site?: string }> };

export default async function SoftwareConnectorSetupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/cameras/connector");
  const runtime = await loadObserverRuntime(profile.id);
  const site = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  const mode = observerModeForSite(site);
  const backHref = `/digital-observer/cameras/add${site ? `?site=${site.id}&new_camera=1` : ""}`;
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/cameras" title="התקנת Connector" desktopTitle="תצפיתן דיגיטלי" statusLabel="חיבור יוצא ומאובטח" flowBackHref={backHref}>
    <div className="do-page-stack">
      <section className="do-panel do-form-section">
        <div className="do-section-head"><div><h1>Software Observer Connector</h1><p>חיבור קל למצלמות ברשת המקומית באמצעות מחשב, שרת או NAS קיים—ללא פתיחת גישה מבחוץ.</p></div><span className="do-badge info">SOFTWARE CONNECTOR</span></div>
        <div className="do-notice good"><ShieldCheck /><span>החיבור יוצא בלבד. סיסמאות המצלמות נשארות בכספת המקומית ואינן מוצגות בדפדפן.</span></div>
        <ol className="do-pairing-instructions">
          <li><Download /> מורידים ומפעילים את חבילת ה־Connector המאושרת על המחשב המקומי.</li>
          <li><LockKeyhole /> ה־Connector יציג כתובת אימות מאובטחת, ללא הצגת קוד סודי.</li>
          <li><Check /> מאשרים כאן את האתר, ואז האיתור והמיפוי ממשיכים אוטומטית.</li>
        </ol>
        <div className="do-notice info"><ServerCog /><span>Docker/Linux הם מסלול האריזה הנתמך כעת. macOS משתמש באותה ליבת Gateway וב־Keychain. Windows עדיין אינו מסומן כנתמך.</span></div>
        <p>לאחר הפעלת החבילה, פתחו את קישור האימות שהיא מציגה. המערכת תחזור למסך החיבור עם בקשת אישור חד־פעמית.</p>
        <div className="do-form-actions"><Link className="do-button secondary" href={backHref}>חזרה להערכת החיבור</Link><Link className="do-button primary" href={`/digital-observer/cameras/add${site ? `?site=${site.id}` : ""}`}>יש לי קישור אימות</Link></div>
      </section>
    </div>
  </ObserverAppShell>;
}
