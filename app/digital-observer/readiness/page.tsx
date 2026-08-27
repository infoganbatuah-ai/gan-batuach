import Link from "next/link";
import { AlertTriangle, Bell, BrainCircuit, CheckCircle2, CreditCard, PhoneOff, Route, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { loadObserverRuntime, observerModeForSite } from "@/lib/domain/digital-observer/runtime";
import { getDigitalObserverProductReadiness } from "@/lib/domain/digital-observer/provider-readiness";

function modeLabel(value: string) {
  if (value === "readiness") return "מוכן פנימית";
  if (value === "sandbox_pending") return "ממתין Sandbox";
  return "כבוי";
}

function modeClass(value: string) {
  if (value === "readiness") return "do-badge good";
  if (value === "sandbox_pending") return "do-badge warn";
  return "do-badge bad";
}

export default async function DigitalObserverReadinessPage() {
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/readiness");
  const runtime = await loadObserverRuntime(profile.id);
  const site = runtime.sites[0] ?? null;
  const mode = observerModeForSite(site);
  const readiness = getDigitalObserverProductReadiness();

  return (
    <ObserverAppShell profile={profile} mode={mode} activeHref="/digital-observer/readiness" title="מוכנות ספקים וחירום" statusLabel="ללא פעולות חיצוניות">
      <div className="do-page-stack">
        <div className="do-notice warn">
          <ShieldCheck />
          <span>המסך מציג מוכנות מוצר בלבד. אין חיבור Gateway, אין ניתוח חי, אין חיוב, אין שליחת הודעות ואין חיוג לגורמי חירום.</span>
        </div>

        <section className="do-grid cols-4">
          <article className="do-metric"><BrainCircuit /><strong>{readiness.ai.liveAnalysisEnabled ? "פעיל" : "כבוי"}</strong><span>ניתוח חי</span></article>
          <article className="do-metric"><Bell /><strong>{readiness.summary.enabledChannels}</strong><span>ערוצים פנימיים זמינים</span></article>
          <article className="do-metric"><CreditCard /><strong>{readiness.billing.liveBillingEnabled ? "פעיל" : "כבוי"}</strong><span>חיוב חי</span></article>
          <article className="do-metric alert"><PhoneOff /><strong>אסור</strong><span>חיוג אוטומטי לחירום</span></article>
        </section>

        <section className="do-grid cols-2">
          <article className="do-panel">
            <div className="do-section-head"><div><h2>AI Shadow</h2><p>מנוע האירועים מוכן לניתוח מבוקר, לא להפעלה חיה.</p></div><BrainCircuit /></div>
            <p>{readiness.ai.summary}</p>
            <div className="do-summary-list">
              <div><span>קלט מותר עכשיו</span><strong>{readiness.ai.supportedInputs.join(", ")}</strong></div>
              <div><span>קלט חסום</span><strong>{readiness.ai.blockedInputs.join(", ")}</strong></div>
              <div><span>ביקורת אנושית</span><strong>{readiness.ai.reviewRequiredBeforeAction ? "חובה" : "לא מוגדרת"}</strong></div>
              <div><span>ספק inference</span><strong>{readiness.ai.providerRequiredForInference ? "נדרש בעתיד" : "לא נדרש"}</strong></div>
            </div>
          </article>

          <article className="do-panel">
            <div className="do-section-head"><div><h2>חיוב ומנויים</h2><p>קטלוג, מצבי חשבון ותצוגות מוכנים ללא גבייה.</p></div><CreditCard /></div>
            <div className="do-summary-list">
              <div><span>מצב ספק</span><strong>{readiness.billing.providerMode}</strong></div>
              <div><span>מקור קטלוג</span><strong>{readiness.billing.catalogSource}</strong></div>
              <div><span>פעולות מותרות</span><strong>{readiness.billing.safeActions.length}</strong></div>
              <div><span>פעולות חסומות</span><strong>{readiness.billing.blockedActions.length}</strong></div>
            </div>
            <div className="do-button-row"><Link className="do-button secondary" href="/digital-observer/billing">מסך מנוי וחיוב</Link><Link className="do-button secondary" href="/digital-observer/pricing">חבילות</Link></div>
          </article>
        </section>

        <section className="do-section">
          <div className="do-section-head"><div><h2>ערוצי התראות וניתוב</h2><p>העדפות, תבניות, היסטוריה וסטטוס ספק נשמרים בנפרד מכל שליחה בפועל.</p></div><Bell /></div>
          <div className="do-grid cols-3">
            {readiness.alertChannels.map((channel) => (
              <article className="do-panel" key={channel.key}>
                <div className="do-section-head"><div><h3>{channel.label}</h3><p>{channel.routing}</p></div><span className={modeClass(channel.mode)}>{modeLabel(channel.mode)}</span></div>
                <div className="do-summary-list">
                  <div><span>העדפת משתמש</span><strong>{channel.userPreference}</strong></div>
                  <div><span>תבניות</span><strong>{channel.templateKeys.length}</strong></div>
                  <div><span>היסטוריה</span><strong>{channel.historyState}</strong></div>
                </div>
                <small>{channel.activationGate}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="do-grid cols-2">
          <article className="do-panel">
            <div className="do-section-head"><div><h2>תהליך חירום</h2><p>הסלמה מתחילה באישור אנושי ותיעוד, לא בחיוג אוטומטי.</p></div><AlertTriangle /></div>
            <div className="do-row-list">
              {readiness.emergency.steps.map((step) => (
                <div className="do-row" key={step.order}>
                  <Route />
                  <span className="do-row-main"><strong>{step.order}. {step.title}</strong><small>{step.detail}</small></span>
                  <span className={step.status === "ready_for_policy" ? "do-badge good" : step.status === "requires_human_confirmation" ? "do-badge warn" : "do-badge bad"}>{step.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="do-panel">
            <div className="do-section-head"><div><h2>התרעת שווא</h2><p>כל הסלמה חייבת לאפשר ביטול, תיעוד וכיול.</p></div><CheckCircle2 /></div>
            <div className="do-summary-list">
              <div><span>אישור אנושי</span><strong>{readiness.emergency.humanConfirmationRequired ? "חובה" : "לא מוגדר"}</strong></div>
              <div><span>טיפול בהתרעת שווא</span><strong>{readiness.emergency.falseAlarmFlowRequired ? "חובה" : "לא מוגדר"}</strong></div>
              <div><span>כתובת מאומתת</span><strong>{readiness.emergency.verifiedAddressRequired ? "חובה לפני הפעלה" : "לא נדרש"}</strong></div>
              <div><span>שיחה לגורמי חירום</span><strong>{readiness.emergency.emergencyServicesDialingAllowed ? "מותר" : "חסום תמיד כברירת מחדל"}</strong></div>
            </div>
            <div className="do-notice info"><PhoneOff /><span>בעתיד ניתן להכין שיחת callback אנושית לאנשי קשר מורשים. אין ולא תהיה הפעלה אוטומטית למוקדי חירום בלי החלטה משפטית ותפעולית נפרדת.</span></div>
          </article>
        </section>
      </div>
    </ObserverAppShell>
  );
}
