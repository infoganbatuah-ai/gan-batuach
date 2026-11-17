"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- typed UI adapter for additive PUSH 41 rows. */

import { useCallback, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Clock3, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, UserPlus, UsersRound, XCircle } from "lucide-react";

const roleLabels: Record<string, string> = {
  platform_admin: "מנהל פלטפורמה", organization_owner: "בעל הארגון", organization_admin: "מנהל ארגון",
  site_admin: "מנהל אתר", security_operator: "מפעיל אבטחה", investigator: "חוקר", viewer: "צופה",
  billing_admin: "מנהל חיוב", service_account: "חשבון שירות"
};

const permissions = [
  ["camera.live.view", "צפייה חיה"], ["recordings.view", "הקלטות"], ["evidence.view", "ראיות"],
  ["events.view", "אירועים"], ["investigation.run", "חקירה"], ["notifications.manage", "התראות"],
  ["device_actions.execute", "פעולות התקן"], ["api.credentials.manage", "API"], ["audit.read", "Audit"]
] as const;

async function api(organizationId: string, body?: Record<string, unknown>, isCurrent: () => boolean = () => true) {
  if (!isCurrent()) return;
  const response = await fetch(body ? "/api/digital-observer/enterprise" : `/api/digital-observer/enterprise?organization_id=${encodeURIComponent(organizationId)}`,
    body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, organization_id: organizationId }) } : { cache: "no-store" });
  if (!isCurrent()) return;
  const payload = await response.json();
  if (!isCurrent()) return;
  if (!response.ok) throw new Error(payload.error || "ENTERPRISE_REQUEST_FAILED");
  return payload.data;
}

export function EnterpriseIdentityCenter({ organizations, organizationId }: { organizations: any[]; organizationId: string }) {
  return <ScopedEnterpriseIdentityCenter key={organizationId} organizations={organizations} organizationId={organizationId} />;
}

type FormKey = "invite" | "service" | "sso" | "scim";
type ActionRequest = { event: FormEvent<HTMLFormElement>; formKey: FormKey; build: (data: FormData) => Record<string, unknown> } | { build: () => Record<string, unknown> };

function ScopedEnterpriseIdentityCenter({ organizations, organizationId }: Parameters<typeof EnterpriseIdentityCenter>[0]) {
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [oneTimeSecret, setOneTimeSecret] = useState("");
  const [lifecycle, setLifecycle] = useState(0);
  const ownership = useRef({ active: false, read: 0, action: 0, busy: false, lifecycle: 0, snapshot: null as unknown,
    edits: { invite: 0, service: 0, sso: 0, scim: 0 } });
  const load = useCallback(async (actionCurrent: () => boolean = () => true) => {
    const owner = ownership.current;
    if (!owner.active || !actionCurrent()) return;
    const read = ++owner.read;
    const isCurrent = () => owner.active && owner.read === read && actionCurrent();
    setBusy(true);
    try {
      const value = await api(organizationId, undefined, isCurrent);
      if (!isCurrent()) return;
      setState(value);
    } catch (error) {
      if (!isCurrent()) return;
      setMessage(error instanceof Error ? error.message : "טעינת הארגון נכשלה");
    } finally {
      if (isCurrent() && !owner.busy) setBusy(false);
    }
  }, [organizationId]);
  useLayoutEffect(() => {
    const owner = ownership.current;
    owner.active = true;
    if (owner.lifecycle > 0) { setLifecycle(owner.lifecycle); setBusy(false); }
    void load();
    return () => { owner.active = false; owner.read++; owner.action++; owner.lifecycle++; owner.snapshot = null; owner.busy = false; };
  }, [load]);
  useLayoutEffect(() => { ownership.current.snapshot = state; }, [state]);

  function edited(formKey: FormKey) {
    const owner = ownership.current;
    if (owner.active && owner.lifecycle === lifecycle && owner.snapshot === state) owner.edits[formKey]++;
  }

  async function runAction(request: ActionRequest) {
    const owner = ownership.current;
    if (!owner.active || owner.lifecycle !== lifecycle || owner.snapshot !== state) return;
    if ("event" in request) request.event.preventDefault();
    if (owner.busy) return;
    owner.busy = true;
    const action = ++owner.action;
    owner.read++;
    const isCurrent = () => owner.active && owner.action === action;
    setBusy(true); setMessage(""); setOneTimeSecret("");
    try {
      let form: HTMLFormElement | undefined;
      let revision = 0;
      let body: Record<string, unknown>;
      if ("event" in request) {
        form = request.event.currentTarget;
        revision = owner.edits[request.formKey];
        body = request.build(new FormData(form));
      } else body = request.build();
      const result = await api(organizationId, body, isCurrent);
      if (!isCurrent()) return;
      setOneTimeSecret(result.acceptanceToken || result.credential || "");
      setMessage(result.delivered === false ? "נשמר בהצלחה. ההזמנה לא נשלחה כי ספק חיצוני אינו מופעל." : "הפעולה נשמרה בהצלחה.");
      if (form && "event" in request && owner.edits[request.formKey] === revision) form.reset();
      await load(isCurrent);
    } catch (error) {
      if (!isCurrent()) return;
      setMessage(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      if (isCurrent()) { owner.busy = false; setBusy(false); }
    }
  }

  if (!state) return <section className="do-panel do-empty"><RefreshCw /><strong>{busy ? "טוען את גבולות הארגון…" : "נתוני הארגון אינם זמינים"}</strong><span>{message}</span></section>;
  return <>
    <section className="do-panel">
      <div className="do-section-head"><div><h2>{state.organization.name}</h2><p>תפקיד נוכחי: {roleLabels[state.actor.role] || state.actor.role} · {state.sites.length} אתרים · {state.memberships.length} חברים</p></div><Building2 /></div>
      {organizations.length > 1 ? <div className="do-button-row">{organizations.map((item) => <a className={item.id === organizationId ? "do-button primary" : "do-button secondary"} href={`/digital-observer/enterprise?organization=${item.id}`} key={item.id}>{item.name}</a>)}</div> : null}
      <div className="do-summary-list"><div><span>דוא״ל</span><strong>אימות פעיל</strong></div><div><span>Passkey / TOTP / SSO MFA</span><strong>נתמכים במדיניות</strong></div><div><span>WhatsApp</span><strong>דורש ספק ואישור בעלים</strong></div><div><span>SMS / Twilio לאימות</span><strong>כבוי ללא fallback</strong></div></div>
    </section>

    {message ? <div className="do-notice info"><CheckCircle2 /><span>{message}</span></div> : null}
    {busy ? <p className="do-help-copy" role="status">הבקשה בעיבוד…</p> : null}
    {oneTimeSecret ? <div className="do-notice warn"><KeyRound /><span><strong>סוד חד־פעמי — העתיקו עכשיו:</strong> <code>{oneTimeSecret}</code>. הוא אינו נשמר ולא יוצג שוב.</span></div> : null}

    <section className="do-grid cols-2">
      <form className="do-panel do-form-section" onInput={() => edited("invite")} onChange={() => edited("invite")} onSubmit={(event) => runAction({ event, formKey: "invite", build: (data) => ({ action: "invite", email: data.get("email"), role: data.get("role"),
        site_ids: data.get("site") ? [data.get("site")] : [], expires_in_hours: 72 }) })}>
        <div className="do-section-head"><div><h2>הזמנת משתמש</h2><p>קישור חד־פעמי, תוקף מוגבל ותפקיד שלא חורג מסמכות המזמין.</p></div><UserPlus /></div>
        <div className="do-form-grid"><label className="do-field full"><span>דוא״ל</span><input name="email" type="email" required autoComplete="off" /></label>
          <label className="do-field"><span>תפקיד</span><select name="role" defaultValue="viewer">{Object.entries(roleLabels).filter(([key]) => !["platform_admin","organization_owner","service_account"].includes(key)).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></label>
          <label className="do-field"><span>אתר (ריק = כל האתרים)</span><select name="site"><option value="">כל האתרים המורשים</option>{state.sites.map((site: any) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label></div>
        <button className="do-button primary" type="submit" disabled={busy}><UserPlus /> יצירת הזמנה</button>
      </form>

      <form className="do-panel do-form-section" onInput={() => edited("service")} onChange={() => edited("service")} onSubmit={(event) => runAction({ event, formKey: "service", build: (data) => ({ action: "create_service_account", display_name: data.get("name"),
        permissions: permissions.filter(([key]) => data.get(`p_${key}`)).map(([key]) => key), site_ids: data.get("site") ? [data.get("site")] : [], expires_in_days: 90 }) })}>
        <div className="do-section-head"><div><h2>חשבון שירות</h2><p>זהות מכונה מוגבלת, פגה, ניתנת לסבב ולביטול. אין מפתחות קבועים בלתי מוגבלים.</p></div><KeyRound /></div>
        <div className="do-form-grid"><label className="do-field"><span>שם</span><input name="name" required minLength={2} maxLength={100} /></label><label className="do-field"><span>אתר</span><select name="site"><option value="">כל האתרים המורשים</option>{state.sites.map((site: any) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label></div>
        <div className="do-toggle-grid">{permissions.map(([key,label]) => <label className="do-check" key={key}><input name={`p_${key}`} type="checkbox" defaultChecked={key === "events.view"} /><span>{label}</span></label>)}</div>
        <button className="do-button primary" type="submit" disabled={busy}><KeyRound /> יצירת זהות וסוד חד־פעמי</button>
      </form>
    </section>

    <section className="do-grid cols-2">
      <form className="do-panel do-form-section" onInput={() => edited("sso")} onChange={() => edited("sso")} onSubmit={(event) => runAction({ event, formKey: "sso", build: (data) => ({ action: "configure_sso", connection_key: "primary",
        protocol: data.get("protocol"), mode: "sandbox", issuer: data.get("issuer"), audience: data.get("audience"), metadata_url: null,
        redirect_allowlist: [String(data.get("redirect"))] }) })}>
        <div className="do-section-head"><div><h2>SSO</h2><p>OIDC או SAML במצב Sandbox בלבד. אימות חתימה ו‑MFA נשארים אצל ספק זהות מוכר.</p></div><LockKeyhole /></div>
        <div className="do-form-grid"><label className="do-field"><span>פרוטוקול</span><select name="protocol"><option value="oidc">OIDC</option><option value="saml2">SAML 2.0</option></select></label><label className="do-field"><span>Issuer</span><input name="issuer" type="url" required /></label><label className="do-field"><span>Audience</span><input name="audience" required /></label><label className="do-field"><span>Redirect מורשה</span><input name="redirect" type="url" required /></label></div>
        <button className="do-button secondary" type="submit" disabled={busy}>שמירת הגדרת Sandbox</button>
      </form>
      <form className="do-panel do-form-section" onInput={() => edited("scim")} onChange={() => edited("scim")} onSubmit={(event) => runAction({ event, formKey: "scim", build: () => ({ action: "configure_scim", connection_key: "primary", mode: "sandbox", group_role_mapping: {} }) })}>
        <div className="do-section-head"><div><h2>SCIM</h2><p>חוזה provisioning מבוקר עם סוד חד־פעמי. claims לא מוכרים אינם מעניקים הרשאה.</p></div><UsersRound /></div>
        <div className="do-notice warn"><ShieldCheck /><span>הפעלה אצל ספק זהות חיצוני עדיין דורשת אישור והוכחת Sandbox. Deprovision מבטל גישה אפקטיבית.</span></div>
        <button className="do-button secondary" type="submit" disabled={busy}>הכנת חיבור SCIM Sandbox</button>
      </form>
    </section>

    <section className="do-panel"><div className="do-section-head"><div><h2>חברים והזמנות</h2><p>הרשאות לפי ארגון ואתר; ביטול חברות או session מסיר גישה.</p></div><UsersRound /></div>
      <div className="do-row-list">{state.memberships.map((item: any) => <div className="do-row" key={item.id}><ShieldCheck /><span className="do-row-main"><strong>{roleLabels[item.enterprise_role] || item.enterprise_role}</strong><small>{item.all_sites ? "כל האתרים" : "אתרים מוגדרים"} · {item.active && !item.revoked_at ? "פעיל" : "מבוטל"}</small></span></div>)}
      {state.invitations.map((item: any) => <div className="do-row" key={item.id}><Clock3 /><span className="do-row-main"><strong>{item.invited_email_hint} · {roleLabels[item.enterprise_role] || item.enterprise_role}</strong><small>{item.status} · תוקף {new Date(item.expires_at).toLocaleString("he-IL")}</small></span>{item.status === "pending" ? <button className="do-button secondary" type="button" disabled={busy} onClick={() => void runAction({ build: () => ({ action: "revoke_invitation", invitation_id: item.id }) })}><XCircle /> ביטול</button> : null}</div>)}</div>
    </section>

    <section className="do-panel"><div className="do-section-head"><div><h2>חשבונות שירות</h2><p>מוצגים ללא hash או סוד. תוצאה חיצונית אינה נטענת לכאן.</p></div><KeyRound /></div>
      {state.serviceAccounts.length ? <div className="do-row-list">{state.serviceAccounts.map((item: any) => <div className="do-row" key={item.id}><KeyRound /><span className="do-row-main"><strong>{item.display_name}</strong><small>{item.account_status} · {item.permissions.length} הרשאות · פג {new Date(item.expires_at).toLocaleDateString("he-IL")}</small></span>{item.account_status === "active" ? <div className="do-button-row"><button className="do-button secondary" type="button" disabled={busy} onClick={() => void runAction({ build: () => ({ action: "rotate_service_credential", service_account_id: item.id, expires_in_days: 90, reason: "manual rotation" }) })}>סבב</button><button className="do-button secondary" type="button" disabled={busy} onClick={() => void runAction({ build: () => ({ action: "revoke_service_account", service_account_id: item.id, reason: "manual revocation" }) })}>ביטול</button></div> : null}</div>)}</div> : <div className="do-empty compact"><KeyRound /><strong>אין חשבונות שירות</strong><span>צור זהות רק לצורך מוגדר ובהרשאות המינימליות.</span></div>}
    </section>

    <section className="do-grid cols-2"><article className="do-panel"><div className="do-section-head"><div><h2>SSO / SCIM</h2><p>מצב חיבור אינו הוכחת ספק.</p></div><LockKeyhole /></div><div className="do-summary-list"><div><span>SSO</span><strong>{state.sso.length ? state.sso.map((item: any) => `${item.protocol}:${item.status}`).join(", ") : "לא מוגדר"}</strong></div><div><span>SCIM</span><strong>{state.scim.length ? state.scim.map((item: any) => item.status).join(", ") : "לא מוגדר"}</strong></div><div><span>הוכחה חיצונית</span><strong>ממתינה</strong></div></div></article>
      <article className="do-panel"><div className="do-section-head"><div><h2>Audit ו‑SLO</h2><p>Audit הוא append-only. יעדי שירות אינם טענה לעמידה חוזית.</p></div><ShieldCheck /></div><div className="do-summary-list"><div><span>אירועי Audit אחרונים</span><strong>{state.audit.length}</strong></div><div><span>Sessions</span><strong>{state.sessions.length}</strong></div><div><span>מדיניות SLO</span><strong>{state.slo.length || "טרם הוגדרה"}</strong></div></div></article></section>
  </>;
}
