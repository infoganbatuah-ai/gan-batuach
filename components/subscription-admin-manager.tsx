"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CreditCard, RefreshCw, Save } from "lucide-react";
import { CollapsibleActionPanel } from "@/components/collapsible-action-panel";

const statusLabels: Record<string, string> = {
  active: "פעיל",
  trial: "ניסיון",
  pending_payment: "ממתין לתשלום",
  suspended: "מושעה",
  expired: "פג תוקף",
  cancelled: "בוטל"
};

const planTypeLabels: Record<string, string> = {
  trial: "Trial",
  monthly: "Monthly",
  annual: "Annual",
  enterprise: "Enterprise"
};

async function postJson(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

export function SubscriptionAdminManager({ plans, subscriptions, gardens, payments }: { plans: any[]; subscriptions: any[]; gardens: any[]; payments: any[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeCount = subscriptions.filter((item) => item.status === "active" || item.status === "trial").length;
  const failedCount = payments.filter((item) => item.billing_status === "failed").length;
  const expiredCount = subscriptions.filter((item) => item.status === "expired" || item.status === "suspended").length;
  const defaultPlan = plans[0];
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);

  async function savePlan(event: FormEvent<HTMLFormElement>, close: () => void) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/admin/subscription-plans", {
        name: form.get("name"),
        description: form.get("description"),
        plan_type: form.get("plan_type"),
        price_amount: form.get("price_amount"),
        duration_days: form.get("duration_days") || null,
        trial_days: form.get("trial_days") || 0,
        active_users_limit: form.get("active_users_limit") || null,
        active_children_limit: form.get("active_children_limit") || null,
        camera_limit: form.get("camera_limit") || null,
        storage_limit_mb: form.get("storage_limit_mb") || null,
        active: form.get("active") === "on",
        enabled_features: {
          core_dashboard: form.get("feature_core_dashboard") === "on",
          cameras: form.get("feature_cameras") === "on",
          finance: form.get("feature_finance") === "on",
          smart_insights: form.get("feature_smart_insights") === "on"
        }
      });
      setMessage("תוכנית המנוי נשמרה");
      close();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן לשמור תוכנית");
    }
  }

  async function saveSubscription(event: FormEvent<HTMLFormElement>, close: () => void) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const selectedPlan = planById.get(String(form.get("plan_id"))) ?? defaultPlan;
    try {
      await postJson("/api/admin/subscriptions", {
        garden_id: form.get("garden_id"),
        plan_id: form.get("plan_id") || null,
        status: form.get("status"),
        plan_type: selectedPlan?.plan_type ?? form.get("plan_type") ?? "monthly",
        start_date: form.get("start_date") || undefined,
        expires_at: form.get("expires_at") || null,
        renewal_date: form.get("renewal_date") || null,
        trial_ends_at: form.get("trial_ends_at") || null,
        admin_override: form.get("admin_override") === "on",
        override_reason: form.get("override_reason") || null,
        suspension_reason: form.get("suspension_reason") || null,
        billing_contact_name: form.get("billing_contact_name") || null,
        billing_contact_email: form.get("billing_contact_email") || null,
        billing_contact_phone: form.get("billing_contact_phone") || null
      });
      setMessage("מנוי הגן נשמר");
      close();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן לשמור מנוי");
    }
  }

  return (
    <>
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>מנויים פעילים/Trial</span><strong>{activeCount}</strong></article>
        <article className="card metric-card"><span>מושעים/פג תוקף</span><strong>{expiredCount}</strong></article>
        <article className="card metric-card"><span>תשלומים שנכשלו</span><strong>{failedCount}</strong></article>
        <article className="card metric-card"><span>תוכניות</span><strong>{plans.length}</strong></article>
      </section>

      <CollapsibleActionPanel title="יצירת תוכנית מנוי" buttonLabel="תוכנית חדשה" description="Trial, Monthly, Annual או Enterprise. אפשר לערוך את המחירים והמגבלות בלי לקבע ספק תשלומים.">
        {({ close }) => (
          <form className="card form wizard-form" onSubmit={(event) => savePlan(event, close)}>
            <div className="form-grid">
              <label>שם תוכנית<input name="name" required /></label>
              <label>סוג<select name="plan_type" required>{Object.entries(planTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>מחיר<input name="price_amount" type="number" min="0" step="1" required /></label>
              <label>משך ימים<input name="duration_days" type="number" min="1" /></label>
              <label>ימי ניסיון<input name="trial_days" type="number" min="0" defaultValue="0" /></label>
              <label>מגבלת משתמשים<input name="active_users_limit" type="number" min="0" /></label>
              <label>מגבלת ילדים<input name="active_children_limit" type="number" min="0" /></label>
              <label>מגבלת מצלמות<input name="camera_limit" type="number" min="0" /></label>
              <label>אחסון MB<input name="storage_limit_mb" type="number" min="0" /></label>
              <label>תיאור<input name="description" /></label>
              <label><input name="feature_core_dashboard" type="checkbox" defaultChecked /> דשבורד</label>
              <label><input name="feature_finance" type="checkbox" defaultChecked /> כספים</label>
              <label><input name="feature_cameras" type="checkbox" /> מצלמות</label>
              <label><input name="feature_smart_insights" type="checkbox" /> תובנות</label>
              <label><input name="active" type="checkbox" defaultChecked /> פעילה</label>
            </div>
            <div className="profile-actions"><button className="button primary"><Save size={16} /> שמירה</button><button className="button secondary" type="button" onClick={close}>ביטול</button></div>
          </form>
        )}
      </CollapsibleActionPanel>

      <CollapsibleActionPanel title="שיוך / עדכון מנוי לגן" buttonLabel="עדכון מנוי" description="אדמין יכול להפעיל Trial, להשעות, לחדש, לבטל או לתת override.">
        {({ close }) => (
          <form className="card form wizard-form" onSubmit={(event) => saveSubscription(event, close)}>
            <div className="form-grid">
              <label>גן<select name="garden_id" required><option value="">בחר גן</option>{gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name} · {garden.city}</option>)}</select></label>
              <label>תוכנית<select name="plan_id">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {planTypeLabels[plan.plan_type] ?? plan.plan_type}</option>)}</select></label>
              <label>סטטוס<select name="status" required>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>תאריך התחלה<input name="start_date" type="date" /></label>
              <label>תוקף עד<input name="expires_at" type="datetime-local" /></label>
              <label>חידוש<input name="renewal_date" type="date" /></label>
              <label>סיום Trial<input name="trial_ends_at" type="datetime-local" /></label>
              <label>איש קשר לחיוב<input name="billing_contact_name" /></label>
              <label>מייל לחיוב<input name="billing_contact_email" type="email" /></label>
              <label>טלפון לחיוב<input name="billing_contact_phone" /></label>
              <label>סיבת השעיה<input name="suspension_reason" /></label>
              <label><input name="admin_override" type="checkbox" /> Override אדמין</label>
              <label>סיבת override<input name="override_reason" /></label>
            </div>
            <div className="profile-actions"><button className="button primary"><Save size={16} /> שמירת מנוי</button><button className="button secondary" type="button" onClick={close}>ביטול</button></div>
          </form>
        )}
      </CollapsibleActionPanel>

      <section className="dashboard-section">
        <div className="section-heading"><h2>מנויים פעילים</h2><p>ניהול Trial, חידוש, השעיה, ביטול ותשלומים שנכשלו.</p></div>
        <div className="card-list">
          {subscriptions.length === 0 ? <div className="empty-state"><strong>אין עדיין מנויים</strong><span>צרו מנוי ראשון לגן כדי להתחיל מעקב.</span></div> : subscriptions.map((subscription) => (
            <article className="card action-panel" key={subscription.id}>
              <div className="section-heading">
                <div><h3>{subscription.gardens?.name ?? "גן"}</h3><p>{subscription.subscription_plans?.name ?? subscription.plan_type} · חידוש {subscription.renewal_date ?? "-"}</p></div>
                <span className={["active", "trial"].includes(subscription.status) ? "pill good" : subscription.status === "pending_payment" ? "pill warn" : "pill bad"}>{statusLabels[subscription.status] ?? subscription.status}</span>
              </div>
              <p>{subscription.admin_override ? "Override אדמין פעיל" : subscription.suspension_reason ?? "אין הערת חסימה"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>ספקי תשלום עתידיים</h2><p>המערכת מוכנה ל-adapters: Credit Card, Tranzila, Meshulam, Pelecard, Grow, Stripe.</p></div>
        <div className="grid cols-3 dashboard-panels">{["Credit Card", "Tranzila", "Meshulam", "Pelecard", "Grow", "Stripe"].map((provider) => <article className="card action-panel" key={provider}><CreditCard /><h3>{provider}</h3><p>Adapter עתידי. כרגע חיוב ידני בלבד.</p></article>)}</div>
      </section>
    </>
  );
}

export function GardenSubscriptionActions({ plans }: { plans: any[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function request(action: "request_upgrade" | "request_renewal", planId?: string) {
    setMessage(null);
    setError(null);
    try {
      const data = await postJson("/api/garden/subscription", { action, plan_id: planId });
      setMessage(data.message ?? "הבקשה נשלחה");
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן לשלוח בקשה");
    }
  }
  return (
    <section className="card action-panel">
      <div className="section-heading"><h2>פעולות מנוי</h2><p>חיוב עדיין ידני. הבקשה תגיע לאדמין לטיפול.</p></div>
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="profile-actions">
        <button className="button primary" type="button" onClick={() => request("request_renewal")}><RefreshCw size={16} /> חידוש מנוי</button>
        {plans.filter((plan) => plan.plan_type !== "trial").map((plan) => <button className="button secondary" type="button" key={plan.id} onClick={() => request("request_upgrade", plan.id)}>שדרוג ל-{plan.name}</button>)}
      </div>
    </section>
  );
}
