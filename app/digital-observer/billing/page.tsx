import Link from "next/link";
import { AlertTriangle, Check, CreditCard, FileText, PackageCheck, ShieldCheck } from "lucide-react";
import { ObserverPlanButton } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import {
  formatObserverDate,
  loadObserverRuntime,
  observerModeForSite,
  observerStatusLabel,
  resolveObserverEntitlement
} from "@/lib/domain/digital-observer/runtime";

type BillingCycle = "monthly" | "annual";

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function planPrice(plan: { monthly_price?: number | null; annual_price?: number | null }, cycle: BillingCycle) {
  if (cycle === "annual") return plan.annual_price ? `${money(plan.annual_price)} / שנה` : "תמחור שנתי בהכנה";
  return plan.monthly_price ? `${money(plan.monthly_price)} / חודש` : "תמחור מותאם";
}

function annualSaving(plan: { monthly_price?: number | null; annual_price?: number | null }) {
  const monthlyAnnualized = Number(plan.monthly_price || 0) * 12;
  const annual = Number(plan.annual_price || 0);
  if (!monthlyAnnualized || !annual || annual >= monthlyAnnualized) return null;
  return Math.round((1 - annual / monthlyAnnualized) * 100);
}

export default async function DigitalObserverBillingPage({
  searchParams
}: {
  searchParams?: Promise<{ cycle?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const cycle: BillingCycle = params.cycle === "annual" ? "annual" : "monthly";
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/billing");
  const runtime = await loadObserverRuntime(profile.id);
  const site = runtime.sites[0] ?? null;
  const mode = observerModeForSite(site);
  const subscription = site ? runtime.subscriptions.find((item) => item.observer_site_id === site.id) : null;
  const entitlement = resolveObserverEntitlement(subscription);
  const currentPackage = runtime.packages.find((item) => item.id === subscription?.package_id);
  const invoices = site ? runtime.invoices.filter((item) => item.observer_site_id === site.id) : [];
  const visiblePackages = runtime.packages.filter(
    (item) => item.package_type === mode || (mode === "business" && item.package_type === "enterprise")
  );

  return (
    <ObserverAppShell
      profile={profile}
      mode={mode}
      activeHref="/digital-observer/billing"
      title="מנוי וחיוב"
      statusLabel="חיוב מדומה בלבד"
    >
      <div className="do-page-stack">
        <div className="do-notice warn">
          <AlertTriangle />
          <span>חיוב אמיתי כבוי. אין איסוף כרטיס, חשבונית אמיתית, App Store או Google Play. בחירת חבילה יוצרת בקשת שינוי בלבד.</span>
        </div>

        <section className="do-grid cols-2 do-billing-overview">
          <article className="do-panel do-current-plan">
            <PackageCheck />
            <div>
              <span>החבילה הנוכחית</span>
              <h2>{currentPackage?.name || "לא נבחרה חבילה"}</h2>
              <p>{subscription ? `סטטוס: ${observerStatusLabel(entitlement.status)}` : "האתר עדיין במצב הכנה ללא מנוי פעיל"}</p>
              {entitlement.trialEndsAt ? <small>סיום ניסיון: {formatObserverDate(entitlement.trialEndsAt)}</small> : null}
            </div>
            {currentPackage ? (
              <strong>
                {subscription?.billing_cycle === "annual" && currentPackage.annual_price
                  ? money(currentPackage.annual_price)
                  : money(currentPackage.monthly_price)}
                <small>{subscription?.billing_cycle === "annual" ? " לשנה" : " לחודש"}</small>
              </strong>
            ) : null}
          </article>

          <article className="do-panel">
            <h2>מה זמין במסלול</h2>
            <p>מצב המנוי והמגבלות נקבעים בשרת. האפליקציה אינה יכולה להפעיל הרשאות בעצמה.</p>
            <div className="do-summary-list">
              <div><span>בדיקת חיבור מצלמה</span><strong>{entitlement.canTestConnection ? "זמינה" : "חסומה"}</strong></div>
              <div><span>צפייה וניטור</span><strong>{entitlement.canUseLiveMonitoring ? "מותר במסלול; ספק חי עדיין כבוי" : "כבויים"}</strong></div>
              <div><span>חיוב חי</span><strong>כבוי</strong></div>
            </div>
          </article>
        </section>

        <section className="do-section do-billing-plans">
          <div className="do-section-head">
            <div>
              <h2>בחירת חבילה</h2>
              <p>המחירים נשלפים מהמסד וניתנים לעריכה באדמין ללא שינוי קוד.</p>
            </div>
            <div className="do-billing-cycle" role="group" aria-label="מחזור חיוב">
              <Link className={cycle === "monthly" ? "active" : ""} href="/digital-observer/billing?cycle=monthly">חודשי</Link>
              <Link className={cycle === "annual" ? "active" : ""} href="/digital-observer/billing?cycle=annual">שנתי</Link>
            </div>
          </div>

          {visiblePackages.length ? (
            <div className="do-plan-grid">
              {visiblePackages.map((item) => {
                const saving = cycle === "annual" ? annualSaving(item) : null;
                return (
                  <article className={currentPackage?.id === item.id ? "do-plan selected" : "do-plan"} key={item.id}>
                    <div className="do-plan-heading">
                      <span className="do-badge info">{observerStatusLabel(item.package_type)}</span>
                      {saving ? <span className="do-badge good">חיסכון {saving}%</span> : null}
                    </div>
                    <h3>{item.name}</h3>
                    <strong>{planPrice(item, cycle)}</strong>
                    <ul>
                      <li><Check /> עד {item.camera_limit ?? "לפי הסכם"} מצלמות</li>
                      <li><Check /> שמירת מקטע עד {item.recording_retention_hours ?? 0} שעות</li>
                      <li><Check /> ביקורת אנושית {item.human_review_required ? "חובה" : "לפי הגדרה"}</li>
                      <li><Check /> ערוצים: {Array.isArray(item.alert_channels) ? item.alert_channels.join(", ") : "In-app"}</li>
                    </ul>
                    {site && currentPackage?.id !== item.id ? (
                      <ObserverPlanButton siteId={site.id} packageId={item.id} billingCycle={cycle} />
                    ) : (
                      <span className="do-badge good">{currentPackage?.id === item.id ? "החבילה הנוכחית" : "יש להקים אתר"}</span>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="do-empty">
              <CreditCard />
              <strong>החבילות אינן זמינות בסביבה</strong>
              <span>יש להחיל את migration המוצר ולבדוק RLS לקריאת חבילות פעילות.</span>
            </div>
          )}
        </section>

        <section className="do-panel">
          <div className="do-section-head"><div><h2>חשבוניות</h2><p>חשבוניות production לא נוצרות במצב הדגמה.</p></div></div>
          {invoices.length ? (
            <div className="do-table-wrap">
              <table className="do-table">
                <thead><tr><th>מספר</th><th>סכום</th><th>סטטוס</th><th>תאריך</th></tr></thead>
                <tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number}</td><td>{money(invoice.amount)}</td><td>{observerStatusLabel(invoice.status)}</td><td>{formatObserverDate(invoice.issued_at)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="do-empty compact"><FileText /><strong>אין חשבוניות</strong><span>זהו מצב צפוי כל עוד ספק החיוב אינו מחובר.</span></div>
          )}
        </section>

        <div className="do-notice info"><ShieldCheck /><span>תשלומי התצפיתן נשמרים בזרם חיוב נפרד מגן בטוח ומתשלומי הורים לגנים.</span></div>
      </div>
    </ObserverAppShell>
  );
}
