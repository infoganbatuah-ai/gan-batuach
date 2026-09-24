"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";

type Row = Record<string, any>;

const relationLabels: Record<string, string> = {
  mother: "אמא",
  father: "אבא",
  parent: "הורה",
  second_parent: "הורה נוסף",
  grandparent: "סבא/סבתא",
  sibling: "אח/ות",
  babysitter: "בייביסיטר",
  nanny: "מטפל/ת",
  guardian: "אפוטרופוס",
  approved_pickup_contact: "מורשה איסוף",
  emergency_contact: "איש קשר חירום",
  temporary: "הרשאה זמנית",
  other: "אחר"
};

async function postJson(url: string, payload: unknown, method = "POST") {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

export function ParentPickupCenter({ children, contacts, events }: { children: Row[]; contacts: Row[]; events: Row[] }) {
  const [contactRows, setContactRows] = useState(contacts);
  const [eventRows] = useState(events);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const defaultChildId = children[0]?.id ?? "";

  async function submitContact(formData: FormData) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const temporary = Boolean(formData.get("temporary"));
      const validFrom = String(formData.get("valid_from") || "");
      const validUntil = String(formData.get("valid_until") || "");
      const data = await postJson("/api/parent/pickup-contacts", {
        child_id: String(formData.get("child_id") || ""),
        full_name: String(formData.get("full_name") || ""),
        relation: String(formData.get("relation") || "other"),
        phone: String(formData.get("phone") || "") || null,
        temporary,
        valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        notes: String(formData.get("notes") || "") || null
      });
      setContactRows((current) => [data, ...current]);
      setMessage(temporary ? "הרשאה זמנית נוצרה" : "מורשה האיסוף נשמר");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת מורשה האיסוף נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(contact: Row) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const data = await postJson("/api/parent/pickup-contacts", { id: contact.id, active: false }, "PATCH");
      setContactRows((current) => current.map((row) => row.id === data.id ? { ...row, ...data } : row));
      setMessage("ההרשאה בוטלה");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ביטול ההרשאה נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <section className="grid cols-2 dashboard-panels">
        <form className="card form compact-form" action={submitContact}>
          <div className="section-heading"><h2>הוספת מורשה איסוף</h2><p>הגן עדיין מבצע בדיקה אנושית לפני שחרור ילד. אין אישור אוטומטי.</p></div>
          <div className="form-grid">
            <label>ילד/ה<select name="child_id" defaultValue={defaultChildId} required>{children.map((child) => <option value={child.id} key={child.id}>{child.full_name}</option>)}</select></label>
            <label>קרבה<select name="relation" defaultValue="grandparent">{Object.entries(relationLabels).filter(([key]) => key !== "temporary").map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
            <label>שם מלא<input name="full_name" required /></label>
            <label>טלפון<input name="phone" inputMode="tel" /></label>
            <label><input type="checkbox" name="temporary" /> הרשאה זמנית בלבד</label>
            <label>תקף מ<input name="valid_from" type="datetime-local" /></label>
            <label>תקף עד<input name="valid_until" type="datetime-local" /></label>
            <label className="wide">הערות<textarea name="notes" rows={3} /></label>
          </div>
          <button className="button primary" disabled={busy || children.length === 0}>שמירת הרשאה</button>
        </form>

        <article className="card action-panel">
          <div className="section-heading"><h2>מורשי איסוף פעילים</h2><p>ניתן לבטל הרשאה בכל רגע. ביטול נשלח גם לגן.</p></div>
          {contactRows.length === 0 ? <div className="empty-state"><strong>עדיין אין מורשי איסוף</strong><span>הוסיפו הורה, סבא/סבתא או איש קשר זמני.</span></div> : contactRows.map((contact) => <div className="list-item" key={contact.id}><div><strong>{contact.full_name}</strong><span>{relationLabels[contact.relation] ?? contact.relation} · {contact.phone ?? "אין טלפון"}</span>{contact.valid_until ? <span>תקף עד {new Date(contact.valid_until).toLocaleString("he-IL")}</span> : null}</div><div className="profile-actions"><span className={contact.active ? "pill good" : "pill bad"}>{contact.active ? "פעיל" : "בוטל"}</span>{contact.active ? <button className="button secondary tiny" disabled={busy} onClick={() => revoke(contact)}>ביטול</button> : null}</div></div>)}
        </article>
      </section>

      <section className="card action-panel">
        <div className="section-heading"><h2>היסטוריית איסוף</h2><p>תיעוד איסוף נשמר לבקרה בלבד.</p></div>
        {eventRows.length === 0 ? <div className="empty-state"><strong>אין אירועי איסוף עדיין</strong><span>כאשר הגן יתעד איסוף, הוא יופיע כאן.</span></div> : <div className="timeline-list">{eventRows.map((event) => <div className="timeline-item" key={event.id}><span className={event.status === "unusual" ? "severity-dot critical" : "severity-dot low"} /><div><strong>{event.children?.full_name ?? "ילד/ה"} נאסף/ה על ידי {event.pickup_person}</strong><small>{new Date(event.pickup_time).toLocaleString("he-IL")} · {event.authorization_type}</small>{event.notes ? <p>{event.notes}</p> : null}</div></div>)}</div>}
      </section>
    </div>
  );
}

export function GardenPickupVerificationPanel({ childRows, contacts, events, currentTime }: { childRows: Row[]; contacts: Row[]; events: Row[]; currentTime: string }) {
  const [eventRows, setEventRows] = useState(events);
  const [selectedChildId, setSelectedChildId] = useState(childRows[0]?.id ?? "");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const contactsForChild = useMemo(() => contacts.filter((contact) => {
    const now = new Date(currentTime).getTime();
    return contact.child_id === selectedChildId && contact.active && contact.authorization_status === "approved"
      && (!contact.valid_from || new Date(contact.valid_from).getTime() <= now)
      && (!contact.valid_until || new Date(contact.valid_until).getTime() > now);
  }), [contacts, selectedChildId, currentTime]);
  const blockedContactsForChild = useMemo(() => contacts.filter((contact) => {
    const now = new Date(currentTime).getTime();
    return contact.child_id === selectedChildId && (
      !contact.active ||
      contact.authorization_status !== "approved" ||
      (contact.valid_until && new Date(contact.valid_until).getTime() <= now)
    );
  }), [contacts, selectedChildId, currentTime]);
  const selectedContact = contactsForChild.find((contact) => contact.id === selectedContactId);

  async function recordPickup() {
    setBusy(true); setError(null); setMessage(null);
    try {
      if (!selectedContactId) throw new Error("בחרו מורשה איסוף פעיל. חריגים דורשים טיפול נפרד.");
      const data = await postJson("/api/garden/pickup-events", {
        child_id: selectedChildId,
        pickup_contact_id: selectedContactId
      });
      setEventRows((current) => [data, ...current]);
      setMessage("השחרור אושר ונרשם על ידי הצוות.");
      setSelectedContactId("");
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "רישום האיסוף נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <section className="grid cols-2 dashboard-panels">
        <form className="card form compact-form ux06-release-form" onSubmit={(event) => { event.preventDefault(); if (selectedContact) setConfirming(true); }}>
          <div className="section-heading"><h2>רישום איסוף</h2><p>המערכת מציגה הרשאות, אבל הצוות מאשר בפועל. אין שחרור אוטומטי.</p></div>
          <div className="form-grid">
            <label>ילד/ה<select value={selectedChildId} onChange={(event) => { setSelectedChildId(event.target.value); setSelectedContactId(""); setConfirming(false); }} required>{childRows.map((child) => <option value={child.id} key={child.id}>{child.full_name}</option>)}</select></label>
            <label>מורשה איסוף<select name="pickup_contact_id" value={selectedContactId} onChange={(event) => { setSelectedContactId(event.target.value); setConfirming(false); }} required><option value="">בחרו מורשה פעיל</option>{contactsForChild.map((contact) => <option value={contact.id} key={contact.id}>{contact.full_name} · {relationLabels[contact.relation] ?? contact.relation}</option>)}</select></label>
          </div>
          <button className="button primary" disabled={busy || !selectedChildId || !selectedContactId}>בדיקה לפני שחרור</button>
        </form>

        <article className="card action-panel">
          <div className="section-heading"><h2>מורשים לילד הנבחר</h2><p>תמונת reference היא לעזרה אנושית בלבד. אין face approval אוטומטי.</p></div>
          {contactsForChild.length === 0 ? <div className="empty-state"><strong>אין מורשי איסוף פעילים</strong><span>אין לשחרר ילד ללא הרשאה תקפה; יש לפנות למנהל/ת לטיפול בחריג.</span></div> : contactsForChild.map((contact) => <div className="list-item" key={contact.id}><div><strong>{contact.full_name}</strong><span>{relationLabels[contact.relation] ?? contact.relation} · {contact.phone ?? "אין טלפון"}</span>{contact.valid_until ? <span>תקף עד {new Date(contact.valid_until).toLocaleString("he-IL")}</span> : null}</div><span className={contact.authorization_type === "temporary" ? "pill warn" : "pill good"}>{contact.authorization_type === "temporary" ? "זמני" : "מאושר"}</span></div>)}
          {blockedContactsForChild.length ? <div className="ux06-blocked-pickups" aria-label="הרשאות חסומות">{blockedContactsForChild.map((contact) => <div className="list-item" key={contact.id}><div><strong>{contact.full_name}</strong><span>{relationLabels[contact.relation] ?? contact.relation} · אין לאשר שחרור</span></div><span className="pill bad">{!contact.active ? "בוטל" : contact.authorization_status === "approved" ? "פג תוקף" : "לא מאושר"}</span></div>)}</div> : null}
        </article>
      </section>
      {confirming && selectedContact ? <section className="ux06-release-confirmation" role="dialog" aria-modal="true" aria-labelledby="release-confirmation-title">
        <div>
          <ShieldCheck size={34} />
          <span>אישור צוות נדרש</span>
          <h2 id="release-confirmation-title">לאשר שחרור?</h2>
          <p><b>{childRows.find((child) => child.id === selectedChildId)?.full_name ?? "ילד/ה"}</b> יימסר/תימסר ל־<b>{selectedContact.full_name}</b>.</p>
          <dl><div><dt>קרבה</dt><dd>{relationLabels[selectedContact.relation] ?? selectedContact.relation}</dd></div><div><dt>מצב הרשאה</dt><dd>מאושר ותקף</dd></div></dl>
          <div><button className="button secondary" type="button" disabled={busy} onClick={() => setConfirming(false)}>חזרה</button><button className="button primary" type="button" disabled={busy} onClick={recordPickup}>{busy ? "מאמת בשרת..." : "אישור שחרור ורישום"}</button></div>
          <small>השרת בודק שוב נוכחות, הקשר גן והרשאה ברגע האישור.</small>
        </div>
      </section> : null}
      <section className="card action-panel">
        <div className="section-heading"><h2>אירועי איסוף אחרונים</h2><p>אירועים חריגים ובקשות אישור הורה מקבלים התראה.</p></div>
        {eventRows.length === 0 ? <div className="empty-state"><strong>אין איסופים חדשים</strong><span>רישום איסוף יופיע כאן.</span></div> : <div className="timeline-list">{eventRows.map((event) => <div className="timeline-item" key={event.id}><span className={event.status === "unusual" || event.authorization_type === "unauthorized" ? "severity-dot critical" : "severity-dot low"} /><div><strong>{event.children?.full_name ?? "ילד/ה"} · {event.pickup_person}</strong><small>{event.pickup_time ? new Date(event.pickup_time).toLocaleString("he-IL") : ""} · {event.status}</small>{event.parent_confirmation_requested ? <p className="warning-text"><ShieldAlert size={14} /> נשלחה בקשת אישור הורה</p> : null}{event.face_match_status === "not_run" ? <p><ShieldCheck size={14} /> זיהוי פנים לא הופעל. בדיקה אנושית בלבד.</p> : null}</div></div>)}</div>}
      </section>
    </div>
  );
}
