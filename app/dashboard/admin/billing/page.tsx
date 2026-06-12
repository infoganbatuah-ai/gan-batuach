import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  BellRing,
  Building2,
  CreditCard,
  FileText,
  Landmark,
  ReceiptText,
  RefreshCcw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type BillingData = {
  subscriptions: any[];
  plans: any[];
  payments: any[];
  invoices: any[];
  receipts: any[];
  reminders: any[];
  gateways: any[];
  settings: any[];
  retryAttempts: any[];
  invoiceJobs: any[];
  notifications: any[];
  auditEvents: any[];
  refunds: any[];
  networks: any[];
  revenueSnapshots: any[];
  exports: any[];
  insights: any[];
  payoutConfigurations: any[];
  parentAuthorizations: any[];
  parentTransactions: any[];
  discountCodes: any[];
  separationLedger: any[];
};

const emptyData: BillingData = {
  subscriptions: [],
  plans: [],
  payments: [],
  invoices: [],
  receipts: [],
  reminders: [],
  gateways: [],
  settings: [],
  retryAttempts: [],
  invoiceJobs: [],
  notifications: [],
  auditEvents: [],
  refunds: [],
  networks: [],
  revenueSnapshots: [],
  exports: [],
  insights: [],
  payoutConfigurations: [],
  parentAuthorizations: [],
  parentTransactions: [],
  discountCodes: [],
  separationLedger: []
};

function money(value: unknown, currency = "ILS") {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "לא נקבע" : date.toLocaleDateString("he-IL");
}

function toneForStatus(status?: string | null) {
  if (["active", "paid", "ready", "sent", "completed", "processed", "production_ready"].includes(String(status))) return "good" as const;
  if (["failed", "cancelled", "suspended", "past_due", "blocked"].includes(String(status))) return "bad" as const;
  if (["trial", "pending_payment", "queued", "scheduled", "test_mode", "not_configured", "needs_review", "manual_review"].includes(String(status))) return "warn" as const;
  return "default" as const;
}

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    active: "פעיל",
    trial: "ניסיון",
    pending_payment: "ממתין לתשלום",
    past_due: "באיחור",
    failed: "נכשל",
    paid: "שולם",
    open: "פתוח",
    draft: "טיוטה",
    refunded: "הוחזר",
    cancelled: "בוטל",
    suspended: "מושעה",
    production_ready: "מוכן לייצור",
    test_mode: "בדיקה",
    not_configured: "לא הוגדר",
    configured: "מוגדר",
    queued: "בתור",
    sent: "נשלח",
    completed: "הושלם",
    needs_review: "דורש בדיקה"
  };
  return map[String(status ?? "")] ?? "ממתין";
}

function monthlyValue(subscription: any) {
  const plan = subscription.subscription_plans ?? {};
  const cycle = String(subscription.billing_cycle ?? subscription.plan_type ?? "annual");
  if (subscription.status !== "active") return 0;
  if (cycle === "annual") return Number(plan.annual_price ?? plan.price_amount ?? 0) / 12;
  return Number(plan.monthly_price ?? plan.price_amount ?? 0);
}

export default async function AdminBillingPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("financial operations billing", async () => {
    const supabase = await createClient();
    const [
      subscriptionsRes,
      plansRes,
      paymentsRes,
      invoicesRes,
      receiptsRes,
      remindersRes,
      gatewaysRes,
      settingsRes,
      retryRes,
      invoiceJobsRes,
      notificationsRes,
      auditRes,
      refundsRes,
      networksRes,
      revenueRes,
      exportsRes,
      insightsRes,
      payoutRes,
      parentAuthRes,
      parentTransactionsRes,
      discountsRes,
      separationRes
    ] = await Promise.all([
      supabase.from("kindergarten_subscriptions" as any).select("*, gardens(name, city), subscription_plans(name, plan_type, price_amount, monthly_price, annual_price, currency, plan_category)").order("created_at", { ascending: false }).limit(300),
      supabase.from("subscription_plans" as any).select("id,name,description,plan_type,price_amount,monthly_price,annual_price,currency,trial_days,active,active_status,plan_category,billing_cycle_options,public_purchase_enabled,enterprise_contact_required,features,limits,sort_order").order("sort_order"),
      supabase.from("subscription_payments" as any).select("id,subscription_id,garden_id,provider,payment_gateway_key,payment_reference,payment_method,amount,currency,billing_status,gateway_status,paid_at,failed_at,failure_reason,retry_count,next_retry_at,created_at,gardens(name,city)").order("created_at", { ascending: false }).limit(160),
      supabase.from("billing_invoices" as any).select("id,subscription_id,garden_id,invoice_number,invoice_type,amount,currency,billing_status,issued_at,due_at,paid_at,pdf_url,emailed_at,email_status,accounting_export_status,gardens(name,city)").order("issued_at", { ascending: false }).limit(160),
      supabase.from("billing_receipts" as any).select("id,receipt_number,amount,currency,issued_at,payment_method,gardens(name,city)").order("issued_at", { ascending: false }).limit(80),
      supabase.from("subscription_reminders" as any).select("id,subscription_id,garden_id,reminder_key,scheduled_for,channel,status,title,gardens(name,city)").order("scheduled_for", { ascending: true }).limit(100),
      supabase.from("payment_gateway_readiness" as any).select("*").order("provider_type"),
      supabase.from("company_billing_settings" as any).select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("payment_retry_attempts" as any).select("id,garden_id,subscription_id,payment_id,attempt_number,status,scheduled_for,attempted_at,failure_reason,next_action,gardens(name,city)").order("scheduled_for", { ascending: true }).limit(100),
      supabase.from("invoice_generation_jobs" as any).select("id,job_key,garden_id,status,pdf_status,email_status,scheduled_for,completed_at,error_message,gardens(name,city)").order("created_at", { ascending: false }).limit(100),
      supabase.from("billing_notifications" as any).select("id,notification_type,channel,status,title,scheduled_for,sent_at,gardens(name,city)").order("scheduled_for", { ascending: false }).limit(100),
      supabase.from("financial_audit_events" as any).select("id,event_type,severity,title,garden_id,created_at,gardens(name,city)").order("created_at", { ascending: false }).limit(100),
      supabase.from("billing_refund_credit_notes" as any).select("id,refund_key,garden_id,refund_type,status,amount,currency,reason,created_at,gardens(name,city)").order("created_at", { ascending: false }).limit(80),
      supabase.from("billing_network_accounts" as any).select("id,account_name,billing_contact_name,billing_contact_email,centralized_invoicing,status,created_at").order("created_at", { ascending: false }).limit(80),
      supabase.from("revenue_snapshots" as any).select("*").order("snapshot_date", { ascending: false }).limit(30),
      supabase.from("accounting_export_batches" as any).select("*").order("created_at", { ascending: false }).limit(40),
      supabase.from("financial_ai_insights" as any).select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("kindergarten_payout_configurations" as any).select("id,garden_id,destination_key,destination_type,provider,status,account_holder_name,billing_email,receives_parent_payments,verified_at,gardens(name,city)").order("created_at", { ascending: false }).limit(160),
      supabase.from("parent_payment_authorizations" as any).select("id,garden_id,child_id,parent_profile_id,billing_cycle,amount,currency,status,next_billing_date,gardens(name,city)").order("created_at", { ascending: false }).limit(160),
      supabase.from("parent_payment_transactions" as any).select("id,garden_id,child_id,revenue_stream,billing_cycle,amount,currency,provider,status,routed_directly_to_kindergarten,paid_at,failed_at,gardens(name,city)").order("created_at", { ascending: false }).limit(160),
      supabase.from("subscription_discount_codes" as any).select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("revenue_separation_ledger" as any).select("id,revenue_type,source_table,amount,currency,destination_account_type,status,created_at,gardens(name,city)").order("created_at", { ascending: false }).limit(120)
    ]);

    [
      subscriptionsRes,
      plansRes,
      paymentsRes,
      invoicesRes,
      receiptsRes,
      remindersRes,
      gatewaysRes,
      settingsRes,
      retryRes,
      invoiceJobsRes,
      notificationsRes,
      auditRes,
      refundsRes,
      networksRes,
      revenueRes,
      exportsRes,
      insightsRes,
      payoutRes,
      parentAuthRes,
      parentTransactionsRes,
      discountsRes,
      separationRes
    ].forEach((query, index) => logSupabaseError(`billing query ${index}`, (query as any).error));

    return {
      subscriptions: (subscriptionsRes.data ?? []) as any[],
      plans: (plansRes.data ?? []) as any[],
      payments: (paymentsRes.data ?? []) as any[],
      invoices: (invoicesRes.data ?? []) as any[],
      receipts: (receiptsRes.data ?? []) as any[],
      reminders: (remindersRes.data ?? []) as any[],
      gateways: (gatewaysRes.data ?? []) as any[],
      settings: (settingsRes.data ?? []) as any[],
      retryAttempts: (retryRes.data ?? []) as any[],
      invoiceJobs: (invoiceJobsRes.data ?? []) as any[],
      notifications: (notificationsRes.data ?? []) as any[],
      auditEvents: (auditRes.data ?? []) as any[],
      refunds: (refundsRes.data ?? []) as any[],
      networks: (networksRes.data ?? []) as any[],
      revenueSnapshots: (revenueRes.data ?? []) as any[],
      exports: (exportsRes.data ?? []) as any[],
      insights: (insightsRes.data ?? []) as any[],
      payoutConfigurations: (payoutRes.data ?? []) as any[],
      parentAuthorizations: (parentAuthRes.data ?? []) as any[],
      parentTransactions: (parentTransactionsRes.data ?? []) as any[],
      discountCodes: (discountsRes.data ?? []) as any[],
      separationLedger: (separationRes.data ?? []) as any[]
    };
  }, emptyData);

  const data = result.data;
  const activeSubscriptions = data.subscriptions.filter((item) => item.status === "active");
  const trialSubscriptions = data.subscriptions.filter((item) => item.status === "trial");
  const cancelledSubscriptions = data.subscriptions.filter((item) => ["cancelled", "expired"].includes(String(item.status)));
  const failedPayments = data.payments.filter((item) => ["failed"].includes(String(item.billing_status)) || ["failed", "retry_scheduled"].includes(String(item.gateway_status)));
  const renewals = data.subscriptions.filter((item) => {
    if (!item.renewal_date) return false;
    const renewal = new Date(item.renewal_date).getTime();
    return renewal >= Date.now() && renewal <= Date.now() + 30 * 86400000;
  });
  const mrr = activeSubscriptions.reduce((sum, item) => sum + monthlyValue(item), 0);
  const arr = mrr * 12;
  const openInvoices = data.invoices.filter((item) => ["open", "draft"].includes(String(item.billing_status)));
  const paidInvoices = data.invoices.filter((item) => item.billing_status === "paid");
  const configuredGateways = data.gateways.filter((item) => ["configured", "test_mode", "production_ready", "active"].includes(String(item.status))).length;
  const latestRevenue = data.revenueSnapshots[0];
  const parentTuitionPaid = data.parentTransactions.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const verifiedPayouts = data.payoutConfigurations.filter((item) => item.status === "verified").length;

  return (
    <DashboardShell role="admin" title="חיוב והכנסות">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Financial Operations"
          title="מנוע הכנסות, מנויים שנתיים וחשבוניות"
          subtitle="מרכז אחד למנויי גנים שנתיים, ספקי תשלום, כשלי גבייה, חידושים, חשבוניות, החזרים ותשלומי הורים שמנותבים ישירות לגן."
          badge={money(mrr)}
          badgeTone={mrr > 0 ? "good" : "warn"}
          actions={<Link className="button secondary" href="/dashboard/admin/subscriptions">ניהול מנויים</Link>}
        >
          <div className="setup-checklist">
            <span>אין שמירת אשראי גולמי</span>
            <span>Audit לכל חיוב</span>
            <span>Gateway ניתן להחלפה</span>
          </div>
        </PremiumDashboardHero>

        <AdminDataError message={result.error} />

        <section className="grid cols-5 dashboard-kpis">
          <RoleMetricCard label="MRR" value={money(mrr)} hint={`Snapshot: ${money(latestRevenue?.mrr ?? mrr)}`} tone={mrr ? "good" : "warn"} />
          <RoleMetricCard label="ARR" value={money(arr)} hint="הכנסה שנתית צפויה" tone={arr ? "good" : "warn"} />
          <RoleMetricCard label="לקוחות פעילים" value={activeSubscriptions.length} hint={`${trialSubscriptions.length} בתקופת ניסיון`} tone="good" />
          <RoleMetricCard label="תשלום נכשל" value={failedPayments.length} hint={`${data.retryAttempts.length} ניסיונות חוזרים`} tone={failedPayments.length ? "bad" : "good"} />
          <RoleMetricCard label="חידושים קרובים" value={renewals.length} hint="30 הימים הקרובים" tone={renewals.length ? "warn" : "default"} />
        </section>

        <section className="warning-banner finance-routing-banner">
          הפרדת הכנסות: מנוי שנתי של גן בטוח נכנס לחשבון החברה. תשלומי הורים עוברים ישירות לחשבון הגן, ללא מעבר דרך גן בטוח.
        </section>

        <section className="grid cols-4 action-grid">
          <ActionCard title="תוכניות מנוי" text="שנתי, פיילוט ורשתות" href="/dashboard/admin/billing#plans" icon={CreditCard} tone="good" />
          <ActionCard title="ספקי תשלום" text="Tranzila, Meshulam, Cardcom ועוד" href="/dashboard/admin/billing#gateways" icon={Landmark} />
          <ActionCard title="חשבוניות" text="PDF, מייל וייצוא הנהלת חשבונות" href="/dashboard/admin/billing#invoices" icon={ReceiptText} />
          <ActionCard title="כשלי גבייה" text="Retry, הודעות והחלמה" href="/dashboard/admin/billing#recovery" icon={RefreshCcw} tone={failedPayments.length ? "bad" : "default"} />
        </section>

        <section className="grid cols-3 dashboard-panels">
          <CleanSection title="הפרדת הכנסות" subtitle="שני מסלולי כסף שאסור לערבב.">
            <div className="risk-list">
              <div>מנויי גן בטוח <b>{money(arr)}</b></div>
              <div>שכר לימוד להפקדה בגן <b>{money(parentTuitionPaid)}</b></div>
              <div>רשומות הפרדה <b>{data.separationLedger.length}</b></div>
            </div>
          </CleanSection>
          <CleanSection title="יעדי תשלום גנים" subtitle="חשבון בנק או ספק תשלום של כל גן.">
            <div className="risk-list">
              <div>יעדים מוגדרים <b>{data.payoutConfigurations.length}</b></div>
              <div>מאומתים <b>{verifiedPayouts}</b></div>
              <div>דורשים השלמה <b>{Math.max(0, data.payoutConfigurations.length - verifiedPayouts)}</b></div>
            </div>
          </CleanSection>
          <CleanSection title="תשלומי הורים" subtitle="מנוהלים על ידי הגן ונשלחים לגן.">
            <div className="risk-list">
              <div>אישורי הורים <b>{data.parentAuthorizations.length}</b></div>
              <div>עסקאות <b>{data.parentTransactions.length}</b></div>
              <div>סכום ששולם <b>{money(parentTuitionPaid)}</b></div>
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="מנויי גנים" subtitle="סטטוס מסחרי לפי גן, חידוש ואמצעי תשלום.">
            {data.subscriptions.length ? (
              <div className="stack-list">
                {data.subscriptions.slice(0, 12).map((subscription) => (
                  <article className="list-item" key={subscription.id}>
                    <div>
                      <strong>{subscription.gardens?.name ?? "גן"}</strong>
                      <span>{subscription.subscription_plans?.name ?? subscription.plan_type} · {subscription.billing_cycle ?? "annual"} · חידוש {dateText(subscription.renewal_date)}</span>
                      <small>{subscription.payment_method ?? "אמצעי תשלום לא הוגדר"} · {subscription.gardens?.city ?? ""}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(subscription.status)}>{statusLabel(subscription.status)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין מנויים עדיין" text="לאחר שיוך גן לתוכנית, הוא יופיע כאן." />
            )}
          </CleanSection>

          <CleanSection title="תובנות פיננסיות" subtitle="המלצות בלבד. אין פעולה אוטומטית ללא אישור.">
            {data.insights.length ? (
              <div className="stack-list">
                {data.insights.map((insight) => (
                  <article className="list-item" key={insight.id}>
                    <div>
                      <strong>{insight.title}</strong>
                      <span>{insight.explanation}</span>
                      <small>{insight.recommended_action ?? "מעקב בלבד"}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(insight.severity)}>{insight.severity}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין תובנות פתוחות" text="כאשר תופיע מגמת הכנסות או סיכון גבייה, היא תוצג כאן." />
            )}
          </CleanSection>
        </section>

        <section className="grid cols-3 dashboard-panels" id="plans">
          <CleanSection title="תוכניות" subtitle="מנוי גן בטוח שנתי, פיילוט, קידום ורשתות.">
            <div className="stack-list">
              {data.plans.map((plan) => (
                <article className="list-item" key={plan.id}>
                  <div>
                    <strong>{plan.name}</strong>
                    <span>{money(plan.annual_price ?? plan.price_amount, plan.currency)} לשנה</span>
                    <small>{plan.plan_category ?? plan.plan_type} · רכישה עצמית: {plan.public_purchase_enabled ? "כן" : "לא"}</small>
                  </div>
                  <StatusBadge tone={toneForStatus(plan.active_status ?? (plan.active ? "active" : "inactive"))}>{statusLabel(plan.active_status ?? (plan.active ? "active" : "inactive"))}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="קודי הנחה" subtitle="פיילוט, קידום, מחיר רשת והנחה שנתית.">
            {data.discountCodes.length ? (
              <div className="stack-list">
                {data.discountCodes.map((code) => (
                  <article className="list-item" key={code.id}>
                    <div>
                      <strong>{code.code}</strong>
                      <span>{code.description ?? "ללא תיאור"}</span>
                      <small>{code.discount_type} · נוצל {code.redemption_count ?? 0}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(code.status)}>{statusLabel(code.status)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין קודי הנחה" text="קודי פיילוט, קידום ורשתות יופיעו כאן." />
            )}
          </CleanSection>

          <CleanSection title="הכנסות" subtitle="MRR, ARR, churn וגבייה.">
            <div className="risk-list">
              <div>MRR <b>{money(mrr)}</b></div>
              <div>ARR <b>{money(arr)}</b></div>
              <div>ביטולים / פג תוקף <b>{cancelledSubscriptions.length}</b></div>
              <div>חשבוניות פתוחות <b>{openInvoices.length}</b></div>
              <div>חשבוניות ששולמו <b>{paidInvoices.length}</b></div>
            </div>
          </CleanSection>

          <CleanSection title="רשתות גנים" subtitle="חשבונית מרכזית ומספר גנים תחת חשבון אחד.">
            {data.networks.length ? (
              <div className="stack-list">
                {data.networks.map((network) => (
                  <article className="list-item" key={network.id}>
                    <div>
                      <strong>{network.account_name}</strong>
                      <span>{network.billing_contact_email ?? "אין איש קשר"}</span>
                      <small>חשבונית מרכזית: {network.centralized_invoicing ? "כן" : "לא"}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(network.status)}>{statusLabel(network.status)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין חשבונות רשת עדיין" text="התשתית מוכנה לחיוב מרכזי של כמה גנים." />
            )}
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels" id="gateways">
          <CleanSection title="ספקי תשלום" subtitle="מוכן להפעלה בלי נעילת ספק ובלי שמירת פרטי אשראי גולמיים.">
            <div className="stack-list">
              {data.gateways.map((gateway) => (
                <article className="list-item" key={gateway.id}>
                  <div>
                    <strong>{gateway.provider_name}</strong>
                    <span>{gateway.provider_type} · {gateway.environment}</span>
                    <small>
                      חוזר: {gateway.supports_recurring ? "כן" : "לא"} · Token: {gateway.supports_tokenized_cards ? "כן" : "לא"} · החזר: {gateway.supports_refunds ? "כן" : "לא"}
                    </small>
                  </div>
                  <StatusBadge tone={toneForStatus(gateway.status)}>{statusLabel(gateway.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="הגדרות חברה" subtitle="פרטים לחשבוניות ללא שינוי קוד.">
            {data.settings.length ? (
              <div className="stack-list">
                {data.settings.map((settings) => (
                  <article className="list-item" key={settings.id}>
                    <div>
                      <strong>{settings.company_name}</strong>
                      <span>{settings.billing_email ?? "מייל חיוב חסר"} · מע״מ {settings.vat_number ?? "לא הוגדר"}</span>
                      <small>{settings.invoice_footer ?? "אין כיתוב תחתון"}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(settings.status)}>{statusLabel(settings.status)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="הגדרות חברה חסרות" text="יש להגדיר שם חברה, מייל חיוב, מע״מ ותחתית חשבונית." />
            )}
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels" id="invoices">
          <CleanSection title="חשבוניות וקבלות" subtitle="יצירה, PDF, שליחה וייצוא חשבונאי.">
            {data.invoices.length ? (
              <div className="stack-list">
                {data.invoices.slice(0, 12).map((invoice) => (
                  <article className="list-item" key={invoice.id}>
                    <div>
                      <strong>{invoice.invoice_number}</strong>
                      <span>{invoice.gardens?.name ?? "גן"} · {money(invoice.amount, invoice.currency)} · {dateText(invoice.issued_at)}</span>
                      <small>PDF: {invoice.pdf_url ? "קיים" : "ממתין"} · מייל: {statusLabel(invoice.email_status)} · ייצוא: {invoice.accounting_export_status}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(invoice.billing_status)}>{statusLabel(invoice.billing_status)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין חשבוניות עדיין" text="לאחר תשלום מוצלח תיווצר חשבונית ותישלח ללקוח." />
            )}
          </CleanSection>

          <CleanSection title="Jobs וייצוא" subtitle="PDF, מייל, הנהלת חשבונות ודוחות מס.">
            <div className="risk-list">
              <div>משימות חשבונית <b>{data.invoiceJobs.length}</b></div>
              <div>ייצוא חשבונאי <b>{data.exports.length}</b></div>
              <div>קבלות <b>{data.receipts.length}</b></div>
              <div>החזרים וזיכויים <b>{data.refunds.length}</b></div>
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-3 dashboard-panels" id="recovery">
          <CleanSection title="תשלומים שנכשלו" subtitle="Retry, סיבה והפעולה הבאה.">
            {failedPayments.length ? (
              <div className="stack-list">
                {failedPayments.slice(0, 8).map((payment) => (
                  <article className="list-item" key={payment.id}>
                    <div>
                      <strong>{payment.gardens?.name ?? "גן"}</strong>
                      <span>{money(payment.amount, payment.currency)} · {payment.failure_reason ?? "לא צוינה סיבה"}</span>
                      <small>Retry {payment.retry_count ?? 0} · הבא: {dateText(payment.next_retry_at)}</small>
                    </div>
                    <StatusBadge tone="bad">{statusLabel(payment.billing_status)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין כשלי תשלום פתוחים" text="כשלי גבייה יופיעו כאן עם retry והודעה ללקוח." />
            )}
          </CleanSection>

          <CleanSection title="תזכורות וחידושים" subtitle="לפני חידוש, ניסיון שמסתיים ותשלום נכשל.">
            <div className="stack-list">
              {data.reminders.slice(0, 8).map((reminder) => (
                <article className="list-item" key={reminder.id}>
                  <div>
                    <strong>{reminder.title}</strong>
                    <span>{reminder.gardens?.name ?? "גן"} · {reminder.channel}</span>
                    <small>{dateText(reminder.scheduled_for)}</small>
                  </div>
                  <StatusBadge tone={toneForStatus(reminder.status)}>{statusLabel(reminder.status)}</StatusBadge>
                </article>
              ))}
              {!data.reminders.length ? <EmptyState title="אין תזכורות מתוזמנות" text="תזכורות נוצרות לפי תאריך חידוש או trial." /> : null}
            </div>
          </CleanSection>

          <CleanSection title="הודעות חיוב" subtitle="מייל, SMS, WhatsApp, Push ו־in-app.">
            <div className="stack-list">
              {data.notifications.slice(0, 8).map((notification) => (
                <article className="list-item" key={notification.id}>
                  <div>
                    <strong>{notification.title}</strong>
                    <span>{notification.notification_type} · {notification.channel}</span>
                    <small>{dateText(notification.scheduled_for)}</small>
                  </div>
                  <StatusBadge tone={toneForStatus(notification.status)}>{statusLabel(notification.status)}</StatusBadge>
                </article>
              ))}
              {!data.notifications.length ? <EmptyState title="אין הודעות חיוב עדיין" text="הודעות יופיעו לאחר יצירת חיוב, חשבונית או כשל תשלום." /> : null}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Audit פיננסי" subtitle="כל פעולה מסחרית חייבת להיות מתועדת.">
            {data.auditEvents.length ? (
              <div className="stack-list">
                {data.auditEvents.slice(0, 10).map((event) => (
                  <article className="list-item" key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{event.event_type} · {event.gardens?.name ?? "כללי"}</span>
                      <small>{dateText(event.created_at)}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(event.severity)}>{event.severity}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין אירועי Audit פיננסיים" text="יצירה, שינוי תוכנית, תשלום, חשבונית והחזר יתועדו כאן." />
            )}
          </CleanSection>

          <CleanSection title="החזרות וזיכויים" subtitle="החזר מלא, חלקי, זיכוי והתאמה חשבונאית.">
            {data.refunds.length ? (
              <div className="stack-list">
                {data.refunds.map((refund) => (
                  <article className="list-item" key={refund.id}>
                    <div>
                      <strong>{money(refund.amount, refund.currency)}</strong>
                      <span>{refund.gardens?.name ?? "גן"} · {refund.refund_type}</span>
                      <small>{refund.reason ?? dateText(refund.created_at)}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(refund.status)}>{statusLabel(refund.status)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין החזרות או זיכויים" text="כאשר ייווצר החזר או credit note, הוא יופיע כאן." />
            )}
          </CleanSection>
        </section>

        <CleanSection title="עוזר פיננסי" subtitle="ניתוח מגמות והמלצות. אין שינוי חיוב ללא אישור אנושי.">
          <div className="ai-prompt-grid">
            {[
              { text: "מה מגמת ההכנסות החודש?", icon: TrendingUp },
              { text: "אילו גנים בסיכון churn?", icon: AlertTriangle },
              { text: "אילו חידושים צפויים החודש?", icon: RotateCw },
              { text: "למה תשלומים נכשלו?", icon: Banknote },
              { text: "אילו חשבוניות לא נשלחו?", icon: FileText },
              { text: "מה צריך לפני הפעלת ספק תשלום?", icon: ShieldCheck }
            ].map(({ text, icon: PromptIcon }) => (
              <article className="card mini-card" key={text}>
                <PromptIcon size={20} />
                <strong>{text}</strong>
                <span>תשובה מתוך נתוני billing בלבד.</span>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="grid cols-4 action-grid">
          <ActionCard title="מנויים קיימים" text="שיוך תוכנית לגן" href="/dashboard/admin/subscriptions" icon={CreditCard} />
          <ActionCard title="מרכז תקשורת" text="הודעות חיוב ותזכורות" href="/dashboard/admin/communications" icon={BellRing} />
          <ActionCard title="אינטגרציות" text="ספקים והפעלה בטוחה" href="/dashboard/admin/integrations" icon={Building2} />
          <ActionCard title="Audit" text="מעקב פעולות" href="/dashboard/admin/audit-logs" icon={Sparkles} />
        </section>

        <div className="warning-banner">
          חיוב אמיתי לא הופעל אוטומטית. נדרש לבחור ספק, להגדיר סודות בשרת, להריץ בדיקת תשלום, ולאשר הפעלת ייצור.
        </div>
      </div>
    </DashboardShell>
  );
}
