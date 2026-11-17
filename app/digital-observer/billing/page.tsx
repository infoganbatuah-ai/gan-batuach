import Link from "next/link";
import { AlertTriangle, BarChart3, Building2, Check, CreditCard, FileText, House, ListChecks, PackageCheck, ShieldCheck, Smartphone, Tag } from "lucide-react";
import { ObserverCancelSubscriptionButton, ObserverPlanButton, ObserverRefundButton } from "@/components/digital-observer/observer-action-forms";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import {
  formatObserverDate,
  loadObserverRuntime,
  observerModeForSite,
  observerStatusLabel,
  resolveObserverEntitlement,
  selectObserverSite
} from "@/lib/domain/digital-observer/runtime";

type BillingCycle = "monthly" | "annual";

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function planPrice(plan: { monthly_price?: number | null; annual_price?: number | null; pricing_status?: string | null }, cycle: BillingCycle) {
  if (plan.pricing_status !== "approved") return "ממתין לאישור מחיר מסחרי";
  if (cycle === "annual") return plan.annual_price ? `${money(plan.annual_price)} / שנה` : "תמחור שנתי בהכנה";
  return plan.monthly_price ? `${money(plan.monthly_price)} / חודש` : "תמחור מותאם";
}

function annualSaving(plan: { monthly_price?: number | null; annual_price?: number | null; pricing_status?: string | null }) {
  if (plan.pricing_status !== "approved") return null;
  const monthlyAnnualized = Number(plan.monthly_price || 0) * 12;
  const annual = Number(plan.annual_price || 0);
  if (!monthlyAnnualized || !annual || annual >= monthlyAnnualized) return null;
  return Math.round((1 - annual / monthlyAnnualized) * 100);
}

export default async function DigitalObserverBillingPage({
  searchParams
}: {
  searchParams?: Promise<{ cycle?: string; view?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const cycle: BillingCycle = params.cycle === "annual" ? "annual" : "monthly";
  const paymentView = params.view === "payment";
  const { profile } = await requireDigitalObserverUser("/digital-observer/login?next=/digital-observer/billing");
  const runtime = await loadObserverRuntime(profile.id);
  const site = selectObserverSite(runtime.sites, runtime.cameras);
  const mode = observerModeForSite(site);
  const subscription = site ? runtime.subscriptions.find((item) => item.observer_site_id === site.id) : null;
  const entitlement = resolveObserverEntitlement(subscription);
  const currentPackage = runtime.packages.find((item) => item.id === subscription?.package_id);
  const invoices = site ? runtime.invoices.filter((item) => item.observer_site_id === site.id) : [];
  const commercialEntitlements = site ? runtime.entitlements.filter((item) => item.observer_site_id === site.id) : [];
  const commercialUsage = site ? runtime.commercialUsage.filter((item) => item.observer_site_id === site.id) : [];
  const paymentEvents = site ? runtime.paymentEvents.filter((item) => item.observer_site_id === site.id) : [];
  const refunds = site ? runtime.refunds.filter((item) => item.observer_site_id === site.id) : [];
  const subscriptionChanges = site ? runtime.subscriptionChanges.filter((item) => item.observer_site_id === site.id) : [];
  const checkoutIntents = site ? runtime.checkoutIntents.filter((item) => item.observer_site_id === site.id) : [];
  const visiblePackages = runtime.packages.filter(
    (item) => item.package_type === mode || (mode === "business" && item.package_type === "enterprise")
  );
  const primaryPackages = currentPackage && visiblePackages.findIndex((item) => item.id === currentPackage.id) > 1
    ? visiblePackages.filter((item) => item.id === visiblePackages[0]?.id || item.id === currentPackage.id).slice(0, 2)
    : visiblePackages.slice(0, 2);
  const additionalPackages = visiblePackages.filter((item) => !primaryPackages.some((primary) => primary.id === item.id));
  const renderPlan = (item: (typeof visiblePackages)[number]) => {
    const saving = cycle === "annual" ? annualSaving(item) : null;
    return <article className={currentPackage?.id === item.id ? "do-plan selected" : "do-plan"} key={item.id}>
      <div className="do-plan-heading"><span className="do-plan-audience-icon" aria-hidden="true">{item.package_type === "home" ? <House /> : <Building2 />}</span><span className="do-badge info">{observerStatusLabel(item.package_type)}</span>{saving ? <span className="do-badge good">חיסכון {saving}%</span> : null}</div>
      <h3>{item.name}</h3>
      <strong>{planPrice(item, cycle)}</strong>
      <ul><li><Check /> עד {item.camera_limit ?? "לפי הסכם"} מצלמות</li><li><Check /> שמירת מקטע עד {item.recording_retention_hours ?? 0} שעות</li><li><Check /> ביקורת אנושית {item.human_review_required ? "חובה" : "לפי הגדרה"}</li><li><Check /> ערוצים: {Array.isArray(item.alert_channels) ? item.alert_channels.join(", ") : "In-app"}</li></ul>
      {site && currentPackage?.id !== item.id && item.pricing_status === "approved" ? <ObserverPlanButton siteId={site.id} packageId={item.id} billingCycle={cycle} /> : <span className={currentPackage?.id === item.id ? "do-badge good" : "do-badge warn"}>{currentPackage?.id === item.id ? "החבילה הנוכחית" : site ? "המחיר טרם אושר" : "יש להקים אתר"}</span>}
    </article>;
  };

  return (
    <ObserverAppShell
      profile={profile}
      mode={mode}
      activeHref="/digital-observer/billing"
      title="מנוי וחיוב"
      statusLabel="ספק תשלום כבוי"
    >
      <div className="do-page-stack">
        <div className="do-notice warn">
          <AlertTriangle />
          <span>ספק התשלום כבוי כברירת מחדל. אין איסוף כרטיס או חיוב, ומחיר היסטורי שאינו מאושר אינו זמין ל-checkout.</span>
        </div>

        {!paymentView ? <section className="do-billing-selection-layout">
          <div className="do-section do-billing-plans">
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
              <><div className="do-plan-grid">{primaryPackages.map(renderPlan)}</div>{additionalPackages.length ? <details className="do-billing-extra-plans"><summary>מסלולים נוספים ({additionalPackages.length})</summary><div className="do-plan-grid">{additionalPackages.map(renderPlan)}</div></details> : null}</>
            ) : (
              <div className="do-empty">
                <CreditCard />
                <strong>החבילות אינן זמינות בסביבה</strong>
                <span>יש להחיל את migration המוצר ולבדוק RLS לקריאת חבילות פעילות.</span>
              </div>
            )}
          </div>

          <aside className="do-billing-choice-rail">
            <article className="do-panel do-current-plan">
              <PackageCheck />
              <div>
                <span>החבילה הנוכחית</span>
                <h2>{currentPackage?.name || "לא נבחרה חבילה"}</h2>
                <p>{subscription ? `סטטוס: ${observerStatusLabel(entitlement.status)}` : "האתר עדיין במצב הכנה ללא מנוי פעיל"}</p>
                {entitlement.trialEndsAt ? <small>סיום ניסיון: {formatObserverDate(entitlement.trialEndsAt)}</small> : null}
              </div>
              {currentPackage?.pricing_status === "approved" ? (
                <strong>
                  {subscription?.billing_cycle === "annual" && currentPackage.annual_price
                    ? money(currentPackage.annual_price)
                    : money(currentPackage.monthly_price)}
                  <small>{subscription?.billing_cycle === "annual" ? " לשנה" : " לחודש"}</small>
                </strong>
              ) : currentPackage ? <span className="do-badge warn">מחיר לא מאושר</span> : null}
            </article>
            <article className="do-panel do-billing-entitlement-card">
              <h2>מה זמין במסלול</h2>
              <p>מצב המנוי והמגבלות נקבעים בשרת.</p>
              <div className="do-summary-list">
                <div><span>בדיקת חיבור מצלמה</span><strong>{entitlement.canTestConnection ? "זמינה" : "חסומה"}</strong></div>
                <div><span>צפייה וניטור</span><strong>{entitlement.canUseLiveMonitoring ? "מותר במסלול; ספק חי עדיין כבוי" : "כבויים"}</strong></div>
                <div><span>חיוב חי</span><strong>כבוי</strong></div>
                <div><span>מצב מסחרי</span><strong>{observerStatusLabel(subscription?.commercial_state || entitlement.status)}</strong></div>
                <div><span>תוצאת ספק</span><strong>{observerStatusLabel(subscription?.provider_outcome || "none")}</strong></div>
              </div>
              {site && subscription ? <ObserverCancelSubscriptionButton siteId={site.id} /> : null}
            </article>
            <Link className="do-button primary full" href={`/digital-observer/billing?view=payment&cycle=${cycle}`}><CreditCard /> המשך לפרטי תשלום</Link>
          </aside>
        </section> : <div className="do-billing-payment-head"><Link className="do-button secondary" href={`/digital-observer/billing?cycle=${cycle}`}>חזרה לבחירת חבילה</Link><div><span className="do-badge warn">מוכנות בלבד</span><h2>תשלום מאובטח</h2><p>מסך התשלום מופרד מבחירת המסלול ואינו מחייב בפועל.</p></div></div>}

        {paymentView ? <section className="do-payment-readiness-grid" id="payment-readiness" aria-label="פרטי תשלום במצב מוכנות">
          <article className="do-panel do-payment-readiness-card">
            <div className="do-section-head"><div><h2>פרטי תשלום מאובטח</h2><p>המסך מוכן לחיבור ספק Sandbox, אך אינו שומר או מחייב כרטיס.</p></div><span className="do-badge warn">מוכנות בלבד</span></div>
            <div className="do-payment-method-row"><span className="active"><CreditCard /> כרטיס אשראי</span><span><Smartphone /> Apple Pay</span><span><Smartphone /> Google Pay</span></div>
            <div className="do-payment-placeholder-form" aria-disabled="true">
              <label className="wide"><span>מספר כרטיס</span><input disabled placeholder="יופעל לאחר חיבור ספק תשלום Sandbox" /></label>
              <label><span>תוקף</span><input disabled placeholder="MM / YY" /></label>
              <label><span>CVV</span><input disabled placeholder="•••" /></label>
              <label className="wide"><span>שם בעל הכרטיס</span><input disabled placeholder="לא נאסף בסביבה זו" /></label>
            </div>
            <div className="do-notice info"><ShieldCheck /><span>השרת יהיה מקור האמת למנוי. לא יתבצע חיוב לפני חיבור ספק, webhook ובדיקת Sandbox מלאה.</span></div>
          </article>
          <aside className="do-panel do-order-readiness-card">
            <div className="do-section-head"><div><h2>סיכום הזמנה</h2><p>ללא חיוב בפועל.</p></div></div>
            <dl><div><dt>מסלול</dt><dd>{currentPackage?.name || "טרם נבחר"}</dd></div><div><dt>מחזור</dt><dd>{cycle === "annual" ? "שנתי" : "חודשי"}</dd></div><div><dt>מחיר</dt><dd>{currentPackage ? planPrice(currentPackage, cycle) : "לא זמין"}</dd></div><div><dt>מצב</dt><dd>{observerStatusLabel(entitlement.status)}</dd></div></dl>
            <label className="do-coupon-readiness"><Tag /><input disabled placeholder="קוד קופון" /><button type="button" disabled>החלה</button></label>
            <button className="do-button primary full" type="button" disabled title="חיוב אמיתי כבוי עד חיבור ספק Sandbox מאושר"><CreditCard /> תשלום אינו פעיל בסביבה זו</button>
          </aside>
        </section> : null}

        {paymentView ? <section className="do-grid cols-2">
          <article className="do-panel">
            <div className="do-section-head"><div><h2>זכאויות פעילות</h2><p>המגבלות נאכפות בשרת ואינן תלויות בהסתרת כפתורים.</p></div><ListChecks /></div>
            {commercialEntitlements.length ? <div className="do-summary-list">{commercialEntitlements.map((item) => <div key={item.id}>
              <span>{observerStatusLabel(item.entitlement_key)}</span>
              <strong>{item.grant_status === "active" ? item.boolean_value === true ? "פעיל" : item.limit_value ?? "פעיל" : observerStatusLabel(item.grant_status)}</strong>
            </div>)}</div> : <div className="do-empty compact"><ListChecks /><strong>אין זכאויות מסחריות פעילות</strong><span>הפעלה תתרחש רק לאחר ניסיון מאושר או תשלום שאומת בשרת.</span></div>}
          </article>
          <article className="do-panel">
            <div className="do-section-head"><div><h2>שימוש מיוחס</h2><p>שימוש מדוד, מוקצה, משוער או לא ידוע נשמר בנפרד.</p></div><BarChart3 /></div>
            {commercialUsage.length ? <div className="do-summary-list">{commercialUsage.slice(0, 12).map((item) => <div key={item.id}>
              <span>{observerStatusLabel(item.service)} · {observerStatusLabel(item.usage_category)}</span>
              <strong>{item.quantity} {item.unit} · {observerStatusLabel(item.evidence_class)}</strong>
            </div>)}</div> : <div className="do-empty compact"><BarChart3 /><strong>אין שימוש מיוחס</strong><span>המערכת אינה ממציאה צריכה כאשר אין מקור מדידה.</span></div>}
          </article>
        </section> : null}

        {paymentView ? <section className="do-panel">
          <div className="do-section-head"><div><h2>היסטוריית תשלום ושינויים</h2><p>תוצאה לא ידועה נשארת לא ידועה עד פיוס. אישור לקוח אינו מפעיל מנוי בתשלום.</p></div><CreditCard /></div>
          {paymentEvents.length || checkoutIntents.length || subscriptionChanges.length ? <div className="do-row-list">
            {paymentEvents.map((payment) => {
              const alreadyRefunded = refunds.some((refund) => refund.payment_event_id === payment.id && ["authorized", "provider_pending", "confirmed", "unknown"].includes(String(refund.refund_status)));
              return <div className="do-row" key={`payment-${payment.id}`}><CreditCard /><span className="do-row-main"><strong>{observerStatusLabel(payment.event_type)}</strong><small>{money(Number(payment.amount_minor || 0) / 100)} · {observerStatusLabel(payment.payment_outcome)} · {formatObserverDate(payment.occurred_at || payment.created_at)}</small></span>{site && payment.payment_outcome === "confirmed" && !alreadyRefunded ? <ObserverRefundButton siteId={site.id} paymentEventId={payment.id} amountMinor={Number(payment.amount_minor)} currency={String(payment.currency)} /> : null}</div>;
            })}
            {checkoutIntents.map((checkout) => <div className="do-row" key={`checkout-${checkout.id}`}><ShieldCheck /><span className="do-row-main"><strong>כוונת Checkout · {observerStatusLabel(checkout.checkout_status)}</strong><small>{money(Number(checkout.amount_minor || 0) / 100)} · מצב ספק {observerStatusLabel(checkout.provider_mode)} · {formatObserverDate(checkout.created_at)}</small></span></div>)}
            {subscriptionChanges.map((change) => <div className="do-row" key={`change-${change.id}`}><PackageCheck /><span className="do-row-main"><strong>{observerStatusLabel(change.change_type)} · {observerStatusLabel(change.status)}</strong><small>{change.effective_at ? `מועד: ${formatObserverDate(change.effective_at)}` : "מועד ייקבע לפי מחזור המנוי"}</small></span></div>)}
          </div> : <div className="do-empty compact"><CreditCard /><strong>אין פעילות כספית</strong><span>זהו מצב צפוי כל עוד ספק התשלום כבוי.</span></div>}
        </section> : null}

        {paymentView ? <section className="do-panel">
          <div className="do-section-head"><div><h2>חשבוניות והחזרים</h2><p>אלו רשומות מסחריות פנימיות בלבד. מסמך מס חוקי דורש ספק ותהליך משפטי מאושרים.</p></div></div>
          {invoices.length ? (
            <div className="do-table-wrap">
              <table className="do-table">
                <thead><tr><th>מספר</th><th>סכום</th><th>מצב פנימי</th><th>מסמך מס</th><th>תאריך</th></tr></thead>
                <tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number}</td><td>{money(invoice.amount)}{Number(invoice.credited_amount_minor || 0) > 0 ? <small> · זוכה {money(Number(invoice.credited_amount_minor) / 100)}</small> : null}</td><td>{observerStatusLabel(invoice.invoice_state || invoice.status)}</td><td>{observerStatusLabel(invoice.tax_document_status || "not_requested")}</td><td>{formatObserverDate(invoice.issued_at || invoice.created_at)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="do-empty compact"><FileText /><strong>אין רשומות חשבונית</strong><span>זהו מצב צפוי כל עוד אין תשלום Sandbox שאומת.</span></div>
          )}
          {refunds.length ? <div className="do-row-list">{refunds.map((refund) => <div className="do-row" key={refund.id}><FileText /><span className="do-row-main"><strong>החזר {money(Number(refund.amount_minor || 0) / 100)}</strong><small>{observerStatusLabel(refund.refund_status)} · {formatObserverDate(refund.updated_at || refund.created_at)}</small></span></div>)}</div> : null}
        </section> : null}

        <div className="do-notice info"><ShieldCheck /><span>תשלומי התצפיתן נשמרים בזרם חיוב נפרד מגן בטוח ומתשלומי הורים לגנים.</span></div>
      </div>
    </ObserverAppShell>
  );
}
