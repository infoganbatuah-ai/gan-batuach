"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Boxes, Building2, KeyRound, Palette, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";

type State = { partner: null | { id: string; partner_key: string; partner_type: string; partner_status: string };
  customers: Array<{ id: string; external_customer_reference_hint: string; customer_status: string; created_at: string }>;
  brand: null | { brand_name: string; product_name: string; primary_color: string; accent_color: string; domain_status: string };
  serviceAccounts: Array<{ service_account_id: string; access_kind: string; partner_customer_id: string | null }>;
  externalProof: string; productionActivated: boolean };

export function PartnerIntegrationCenter({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  return <ScopedPartnerIntegrationCenter key={organizationId} organizationId={organizationId} organizationName={organizationName} />;
}

function ScopedPartnerIntegrationCenter({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lifecycle, setLifecycle] = useState(0);
  const ownership = useRef({ active: false, operation: 0, busy: false, lifecycle: 0 });
  const load = useCallback(async () => {
    const owner = ownership.current;
    if (!owner.active || owner.busy) return;
    owner.busy = true;
    const operation = ++owner.operation;
    const isCurrent = () => owner.active && owner.operation === operation;
    setError(null); setState(null); setLoading(true);
    try {
      const response = await fetch(`/api/digital-observer/partners?organization_id=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      if (!isCurrent()) return;
      const payload = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) throw new Error(payload?.error ?? "לא ניתן לטעון את מרכז השותפים");
      setState(payload.data ?? payload);
    } catch (cause) {
      if (!isCurrent()) return;
      setState(null); setError(cause instanceof Error ? cause.message : "שגיאה");
    } finally {
      if (isCurrent()) { owner.busy = false; setLoading(false); }
    }
  }, [organizationId]);
  useLayoutEffect(() => {
    const owner = ownership.current;
    owner.active = true;
    if (owner.lifecycle > 0) setLifecycle(owner.lifecycle);
    void load();
    return () => { owner.active = false; owner.operation++; owner.lifecycle++; owner.busy = false; };
  }, [load]);
  const unavailable = loading ? "טוען…" : "לא זמין";
  return <div className="do-page-stack">
    <section className="do-panel">
      <header className="do-panel-heading"><div><span className="do-eyebrow">OEM / SDK / WHITE-LABEL</span><h2>{organizationName}</h2></div>
        <button className="do-icon-button" onClick={() => { const owner = ownership.current; if (owner.active && owner.lifecycle === lifecycle) void load(); }} disabled={loading} aria-label="רענון"><RefreshCw /></button></header>
      <div className="do-summary-grid">
        <article><Building2 /><strong>{state ? state.partner?.partner_status ?? "לא הוגדר" : unavailable}</strong><span>פרופיל שותף</span></article>
        <article><UsersRound /><strong>{state ? state.customers.length : unavailable}</strong><span>לקוחות שותף</span></article>
        <article><KeyRound /><strong>{state ? state.serviceAccounts.length : unavailable}</strong><span>זהויות שירות ממופות</span></article>
        <article><Palette /><strong>{state ? state.brand?.domain_status ?? "ללא מיתוג" : unavailable}</strong><span>דומיין ומיתוג</span></article>
      </div>
      {error ? <div className="do-notice danger">{error}</div> : null}
      <div className="do-notice info"><ShieldCheck /><span>המערכת פועלת במצב Development/Sandbox בלבד. אין לקוחות אמיתיים, אין הפעלת Production ואין חשיפת סודות בדפדפן.</span></div>
    </section>
    <section className="do-panel"><header className="do-panel-heading"><div><span className="do-eyebrow">CUSTOMERS</span><h2>לקוחות והפרדת הרשאות</h2></div><Boxes /></header>
      {!state ? <div className="do-empty"><UsersRound /><strong>{loading ? "טוען לקוחות…" : "נתוני הלקוחות אינם זמינים"}</strong></div> : !state.customers.length ? <div className="do-empty"><UsersRound /><strong>עדיין אין לקוחות סינתטיים משויכים</strong><span>הקמה מתבצעת דרך חוזה ה‑API המאובטח עם Idempotency והרשאות קיימות.</span></div>
        : <div className="do-table-wrap"><table className="do-table"><thead><tr><th>מזהה חיצוני מצומצם</th><th>סטטוס</th><th>נוצר</th></tr></thead><tbody>{state.customers.map((customer) => <tr key={customer.id}><td>{customer.external_customer_reference_hint}</td><td>{customer.customer_status}</td><td>{new Date(customer.created_at).toLocaleString("he-IL")}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="do-panel"><header className="do-panel-heading"><div><span className="do-eyebrow">BRAND</span><h2>חוויה מוטמעת</h2></div><Palette /></header>
      {!state ? <p>{loading ? "טוען מיתוג…" : "נתוני המיתוג אינם זמינים"}</p> : state.brand ? <div style={{ borderInlineStart: `6px solid ${state.brand.primary_color}`, paddingInlineStart: 16 }}><strong>{state.brand.product_name}</strong><p>{state.brand.brand_name} · {state.brand.domain_status}</p></div>
        : <p>המיתוג נשמר כפרופיל מוגבל ובטוח. הודעות משפטיות נדרשות אינן ניתנות להסרה.</p>}
      <p>אימות מוטמע משתמש באסימון קצר־חיים, תחום לקוח/אתר/Origin וקהל יעד; מפתח שירות ארוך־חיים אינו מגיע לדפדפן.</p>
    </section>
  </div>;
}
