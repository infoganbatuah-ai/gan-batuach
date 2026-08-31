import Link from "next/link";
import { Bell, Building2, Camera, Check, CircleHelp, CreditCard, Info, KeyRound, Settings, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { ObserverQuickAction, ObserverRecipientsDevicesForm, ObserverSettingsForm } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { LogoutButton } from "@/components/logout-button";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { loadObserverRuntime, observerModeForSite, observerStatusLabel, selectObserverSite } from "@/lib/domain/digital-observer/runtime";

export default async function DigitalObserverSettingsPage({ searchParams }: { searchParams?: Promise<{ site?: string }> }) {
  const params = await searchParams;
  const { profile, user } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/settings");
  const runtime = await loadObserverRuntime(profile.id);
  const selectedSite = selectObserverSite(runtime.sites, runtime.cameras, params?.site);
  const site = params?.site && selectedSite?.id !== params.site ? null : selectedSite;
  const mode = observerModeForSite(site); const schedule = site ? runtime.schedules.find((item) => item.observer_site_id === site.id) : null; const channels = site ? runtime.alertSettings.filter((item) => item.observer_site_id === site.id) : []; const recipients = site ? runtime.recipients.filter((item) => item.observer_site_id === site.id) : []; const devices = site ? runtime.deviceSlots.filter((item) => item.observer_site_id === site.id) : []; const subscription = site ? runtime.subscriptions.find((item) => item.observer_site_id === site.id) : null; const currentPackage = runtime.packages.find((item) => item.id === subscription?.package_id);
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/settings" title="מנוי והגדרות" statusLabel="שליטה פרטית"><div className="do-page-stack do-settings-page">
    <nav className="do-settings-tabs" aria-label="אזורי הגדרות"><a className="active" href="#personal">פרטים אישיים</a><a href="#monitoring">הגדרות התראות</a><a href="#access">משתמשים ושיתוף</a><a href="#security">אבטחה</a><a href="#privacy">פרטיות ומחיקת מידע</a></nav>
    <section className="do-profile-banner do-settings-mobile-profile"><span className="do-person-avatar large">{cleanSyntheticLabel(profile.full_name,"מ").slice(0,1)}</span><div><h2>{cleanSyntheticLabel(profile.full_name,"משתמש התצפיתן")}</h2><p>{user.email}</p><Link className="do-profile-edit" href="/digital-observer/onboarding">עריכת פרטים</Link></div></section>
    <article className="do-panel do-settings-plan-summary do-settings-mobile-plan"><div><span>המנוי שלי</span><h2>{currentPackage?.name || (subscription ? "חבילה ללא שם" : "טרם נבחרה חבילה")}</h2><p>{subscription ? `סטטוס: ${observerStatusLabel(subscription.subscription_status ?? subscription.status)}` : "טרם נבחר מסלול. חיוב אמיתי כבוי."}</p>{currentPackage ? <ul className="do-settings-plan-features"><li><Check /> עד {currentPackage.camera_limit ?? "לפי הסכם"} מצלמות</li><li><Check /> שמירת מקטעים עד {currentPackage.recording_retention_hours ?? 0} שעות</li><li><Check /> ביקורת אנושית {currentPackage.human_review_required ? "נדרשת" : "לפי הגדרה"}</li><li><Check /> {Array.isArray(currentPackage.alert_channels) && currentPackage.alert_channels.length ? `${currentPackage.alert_channels.length} ערוצי התראה מוגדרים` : "התראות בתוך האפליקציה"}</li></ul> : null}</div><Link className="do-button secondary" href="/digital-observer/billing">ניהול ושינוי מנוי</Link></article>
    <section className="do-settings-editor-grid" id="personal">
      <article className="do-panel do-settings-data-card">
        <div className="do-section-head"><div><h2>פרטים אישיים</h2><p>פרטי חשבון מאומתים.</p></div><UserRound /></div>
        <label><span>שם מלא</span><input readOnly value={cleanSyntheticLabel(profile.full_name,"לא הוגדר")} /></label>
        <label><span>דוא״ל</span><input readOnly value={user.email || "לא הוגדר"} /></label>
        <label><span>טלפון</span><input readOnly value={user.phone || "לא הוגדר"} /></label>
        <Link className="do-button secondary full" href="/digital-observer/forgot-password">שינוי סיסמה מאובטח</Link>
      </article>
      <article className="do-panel do-settings-data-card">
        <div className="do-section-head"><div><h2>{mode === "home" ? "פרטי הבית" : "פרטי העסק"}</h2><p>האתר הפעיל בחשבון.</p></div><Building2 /></div>
        <label><span>{mode === "home" ? "שם הבית" : "שם העסק"}</span><input readOnly value={site?.name || "טרם הוגדר אתר"} /></label>
        <label><span>כתובת</span><input readOnly value={site?.address_line || site?.city || "כתובת טרם הושלמה"} /></label>
        <label><span>סוג חשבון</span><input readOnly value={mode === "home" ? "ביתי" : "עסקי"} /></label>
        <Link className="do-button secondary full" href="/digital-observer/onboarding">עריכת פרטי האתר</Link>
      </article>
      <div className="do-settings-monitoring-card" id="monitoring">{site ? <ObserverSettingsForm siteId={site.id} schedule={schedule} channels={channels} consent={site.metadata ?? {}} /> : <div className="do-empty"><ShieldCheck /><strong>יש להקים אתר לפני הגדרת ניטור</strong><Link className="do-button primary" href="/digital-observer/onboarding">הקמת אתר</Link></div>}</div>
    </section>
    <section className="do-settings-links" aria-label="הגדרות כלליות"><Link href="#personal"><Settings /><span><strong>הגדרות כלליות</strong><small>פרטי חשבון, אתר וניטור</small></span></Link><Link href="/digital-observer/cameras"><Camera /><span><strong>ניהול מצלמות</strong><small>מקורות, חיבור ומצב מוכנות</small></span></Link><Link href="/digital-observer/people"><UserRound /><span><strong>משתמשים ושיתוף</strong><small>הרשאות, הסכמה ואנשים מוכרים</small></span></Link><Link href="/digital-observer/privacy"><Trash2 /><span><strong>פרטיות ומחיקת מידע</strong><small>גישה, ייצוא, הגבלה ומחיקה</small></span></Link><Link href="/digital-observer/trust#support"><CircleHelp /><span><strong>מרכז עזרה</strong><small>תמיכה, פרטיות ואמון</small></span></Link><Link href="/digital-observer/trust"><Info /><span><strong>אודות האפליקציה</strong><small>מדיניות המוצר ויכולות פעילות</small></span></Link><Link href="/digital-observer/billing"><CreditCard /><span><strong>מנוי וחיוב</strong><small>חבילה, שימוש ובקשות שינוי</small></span></Link></section>
    <div id="access">{site ? <ObserverRecipientsDevicesForm siteId={site.id} recipients={recipients} devices={devices} /> : null}</div>
    {site ? <section className="do-panel"><div className="do-section-head"><div><h2>בדיקת ערוץ בטוחה</h2><p>הבדיקה נרשמת במערכת בלבד ואינה שולחת הודעה חיצונית.</p></div></div><div className="do-button-row"><ObserverQuickAction endpoint="/api/digital-observer/notifications/mock" body={{ observer_site_id: site.id, channel: "in_app" }}><Bell /> בדיקת In-app</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/notifications/mock" body={{ observer_site_id: site.id, channel: "email" }}><Bell /> הדמיית דוא״ל</ObserverQuickAction></div></section> : null}
    <section className="do-panel" id="security"><div className="do-section-head"><div><h2>פעולות חשבון</h2><p>היציאה סוגרת את ההפעלה הנוכחית ומחזירה להתחברות העצמאית של התצפיתן.</p></div><LogoutButton className="do-button secondary" redirectTo="/digital-observer/login" /></div></section>
    <div className="do-notice warn" id="privacy"><KeyRound /><span>אין אפשרות להציג או לערוך סיסמאות מצלמה בדפדפן. ניהול סודות מתבצע בצד השרת וב-Gateway בלבד.</span></div>
  </div></ObserverAppShell>;
}
