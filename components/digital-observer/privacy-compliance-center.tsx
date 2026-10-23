"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileCheck2, LockKeyhole, Scale, ShieldCheck } from "lucide-react";

type PrivacyState = {
  profiles: Array<{ id: string; product_context: string; jurisdiction: string; stated_purpose: string; legal_decision_state: string; active: boolean }>;
  requests: Array<{ id: string; request_type: string; status: string; execution_status: string; external_system_disposition: unknown[]; created_at: string }>;
  holds: Array<{ id: string; hold_type: string; status: string; documented_purpose: string; review_due_at: string | null }>;
  incidents: Array<{ id: string; classification: string; severity: string; status: string; notification_decision: string; created_at: string }>;
  externalLegalApproval: "PENDING";
  sensitiveActivation: string;
};

const statusLabel: Record<string, string> = {
  LEGAL_REVIEW_PENDING: "ממתין לבחינה משפטית",
  TECHNICALLY_IMPLEMENTED: "מיושם טכנית בלבד",
  EXTERNALLY_APPROVED: "אושר חיצונית",
  PROHIBITED: "אסור",
  submitted: "הוגש",
  under_review: "בבדיקה",
  completed: "הושלם",
  active: "פעיל"
};

export function PrivacyComplianceCenter({ siteId }: { siteId: string }) {
  const [state, setState] = useState<PrivacyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch(`/api/digital-observer/privacy-compliance?site_id=${encodeURIComponent(siteId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "לא ניתן לטעון את מרכז הפרטיות");
    setState(payload.data);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/digital-observer/privacy-compliance?site_id=${encodeURIComponent(siteId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "לא ניתן לטעון את מרכז הפרטיות");
        if (!cancelled) setState(payload.data);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "שגיאה"); });
    return () => { cancelled = true; };
  }, [siteId]);

  async function submitRequest(formData: FormData) {
    setPending(true); setError(null);
    try {
      const response = await fetch("/api/digital-observer/privacy-compliance", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "submit_rights_request", site_id: siteId,
          request_type: formData.get("request_type"), purpose: formData.get("purpose") })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "הבקשה לא נשמרה");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאה"); }
    finally { setPending(false); }
  }

  return <div className="do-page-stack">
    <div className="do-notice warn"><AlertTriangle /><span>אין עדיין אישור משפטי חיצוני. זיהוי ביומטרי, ניטור ילדים רגיש, מעקב מיקום וחקירה רגישה נשארים חסומים בשרת.</span></div>
    {error ? <div className="do-notice danger"><AlertTriangle /><span>{error}</span></div> : null}
    <section className="do-card-grid">
      <article className="do-mini-card"><Scale /><strong>אישור משפטי חיצוני</strong><span className="do-badge warn">PENDING</span><small>יישום טכני אינו אישור משפטי.</small></article>
      <article className="do-mini-card"><LockKeyhole /><strong>תכונות רגישות</strong><span className="do-badge good">FAIL CLOSED</span><small>מצב לא ידוע או חסר מסמך שולל הפעלה.</small></article>
      <article className="do-mini-card"><ShieldCheck /><strong>מחיקת מערכת חיצונית</strong><span className="do-badge info">נבדקת בנפרד</span><small>מחיקה מקומית אינה מוכיחה מחיקה מ-DVR/NVR/VMS.</small></article>
    </section>

    <section className="do-panel">
      <div className="do-section-head"><div><h2>פרופילי מדיניות לאתר</h2><p>פרופיל פעיל דורש החלטה חיצונית כתובה ותואמת מטרה, הקשר ותחום.</p></div><FileCheck2 /></div>
      {state?.profiles.length ? <div className="do-row-list">{state.profiles.map((item) => <div className="do-row" key={item.id}><ShieldCheck /><span className="do-row-main"><strong>{item.product_context} · {item.jurisdiction}</strong><small>{item.stated_purpose}</small></span><span className={`do-badge ${item.legal_decision_state === "EXTERNALLY_APPROVED" ? "good" : "warn"}`}>{statusLabel[item.legal_decision_state] || item.legal_decision_state}</span></div>)}</div>
        : <div className="do-empty compact"><Scale /><strong>אין מדיניות מאושרת</strong><span>זהו מצב חסום ובטוח. נדרש profile מתועד והחלטה חיצונית לפני הפעלה רגישה.</span></div>}
    </section>

    <section className="do-grid cols-2">
      <article className="do-panel">
        <div className="do-section-head"><div><h2>בקשת פרטיות</h2><p>גישה, יצוא, תיקון, הגבלה או מחיקה עוברים אימות, scope ובדיקת legal hold.</p></div></div>
        <form action={submitRequest} className="do-page-stack">
          <label><span>סוג בקשה</span><select name="request_type" defaultValue="access"><option value="access">גישה</option><option value="export">יצוא</option><option value="correction">תיקון</option><option value="restriction">הגבלה</option><option value="deletion">מחיקה</option><option value="objection">התנגדות</option></select></label>
          <label><span>מטרת הבקשה</span><textarea name="purpose" minLength={5} maxLength={500} required placeholder="תיאור קצר ומדויק" /></label>
          <button className="do-button primary" type="submit" disabled={pending}>{pending ? "שומר…" : "הגשת בקשה"}</button>
        </form>
      </article>
      <article className="do-panel">
        <div className="do-section-head"><div><h2>בקשות אחרונות</h2><p>קבלה מלאה ניתנת רק לאחר אימות כל המערכות החיצוניות.</p></div></div>
        {state?.requests.length ? <div className="do-summary-list">{state.requests.map((item) => <div key={item.id}><span>{item.request_type}</span><strong>{statusLabel[item.status] || item.status} · {item.execution_status}</strong></div>)}</div>
          : <div className="do-empty compact"><FileCheck2 /><strong>אין בקשות</strong><span>לא בוצעה מחיקה או יצוא אוטומטיים.</span></div>}
      </article>
    </section>

    <section className="do-grid cols-2">
      <article className="do-panel"><div className="do-section-head"><div><h2>Legal holds</h2><p>Hold ממוקד גובר על מחיקה אך אינו מעניק גישה חופשית למידע.</p></div></div>{state?.holds.length ? <div className="do-summary-list">{state.holds.map((item) => <div key={item.id}><span>{item.hold_type}</span><strong>{statusLabel[item.status] || item.status}</strong></div>)}</div> : <div className="do-empty compact"><LockKeyhole /><strong>אין holds גלויים</strong><span>מחיקה עדיין דורשת מדיניות מאושרת ובדיקת scope.</span></div>}</article>
      <article className="do-panel"><div className="do-section-head"><div><h2>אירועי פרטיות</h2><p>החלטת דיווח נשארת בבחינה משפטית; המערכת אינה ממציאה דיווח לרשות.</p></div></div>{state?.incidents.length ? <div className="do-summary-list">{state.incidents.map((item) => <div key={item.id}><span>{item.classification} · {item.severity}</span><strong>{item.status} · {item.notification_decision}</strong></div>)}</div> : <div className="do-empty compact"><ShieldCheck /><strong>אין אירועים מדווחים</strong><span>מצב זה אינו מהווה אישור שאין סיכונים פתוחים.</span></div>}</article>
    </section>
  </div>;
}
