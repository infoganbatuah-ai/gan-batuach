import Link from "next/link";
import { Bell, CreditCard, KeyRound, LifeBuoy, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { ObserverQuickAction, ObserverSettingsForm } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { loadObserverRuntime, observerModeForSite } from "@/lib/domain/digital-observer/runtime";

export default async function DigitalObserverSettingsPage() {
  const { profile, user } = await requireUser("/digital-observer/login?next=/digital-observer/settings"); const runtime = await loadObserverRuntime(profile.id); const site = runtime.sites[0] ?? null; const mode = observerModeForSite(site); const schedule = site ? runtime.schedules.find((item) => item.observer_site_id === site.id) : null; const channels = site ? runtime.alertSettings.filter((item) => item.observer_site_id === site.id) : [];
  return <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/settings" title="הגדרות ופרופיל" statusLabel="שליטה פרטית"><div className="do-page-stack">
    <section className="do-profile-banner"><span className="do-person-avatar large">{cleanSyntheticLabel(profile.full_name,"מ").slice(0,1)}</span><div><h2>{cleanSyntheticLabel(profile.full_name,"משתמש התצפיתן")}</h2><p>{user.email}</p><span className="do-badge info">{mode === "home" ? "חשבון ביתי" : "חשבון עסקי"}</span></div></section>
    {site ? <ObserverSettingsForm siteId={site.id} schedule={schedule} channels={channels} /> : <div className="do-empty"><ShieldCheck /><strong>יש להקים אתר לפני הגדרת ניטור</strong><Link className="do-button primary" href="/digital-observer/onboarding">הקמת אתר</Link></div>}
    {site ? <section className="do-panel"><div className="do-section-head"><div><h2>בדיקת ערוץ בטוחה</h2><p>הבדיקה נרשמת במערכת בלבד ואינה שולחת הודעה חיצונית.</p></div></div><div className="do-button-row"><ObserverQuickAction endpoint="/api/digital-observer/notifications/mock" body={{ observer_site_id: site.id, channel: "in_app" }}><Bell /> בדיקת In-app</ObserverQuickAction><ObserverQuickAction endpoint="/api/digital-observer/notifications/mock" body={{ observer_site_id: site.id, channel: "email" }}><Bell /> הדמיית דוא״ל</ObserverQuickAction></div></section> : null}
    <section className="do-settings-links"><Link href="/digital-observer/billing"><CreditCard /><span><strong>מנוי וחיוב</strong><small>חבילה, שימוש ובקשות שינוי</small></span></Link><Link href="/digital-observer/people"><UserRound /><span><strong>משתמשים ושיתוף</strong><small>הרשאות, הסכמה ואנשים מוכרים</small></span></Link><Link href="/digital-observer/trust#privacy"><LockKeyhole /><span><strong>פרטיות ושמירה</strong><small>מחיקה, retention ו-AI</small></span></Link><Link href="/digital-observer/trust#support"><LifeBuoy /><span><strong>עזרה ותמיכה</strong><small>ערוץ התמיכה של המוצר</small></span></Link></section>
    <section className="do-panel"><div className="do-section-head"><div><h2>פעולות חשבון</h2><p>היציאה סוגרת את ההפעלה הנוכחית ומחזירה להתחברות העצמאית של התצפיתן.</p></div><LogoutButton className="do-button secondary" redirectTo="/digital-observer/login" /></div></section>
    <div className="do-notice warn"><KeyRound /><span>אין אפשרות להציג או לערוך סיסמאות מצלמה בדפדפן. ניהול סודות מתבצע בצד השרת וב-Gateway בלבד.</span></div>
  </div></ObserverAppShell>;
}
