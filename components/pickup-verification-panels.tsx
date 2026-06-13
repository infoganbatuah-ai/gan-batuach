"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { UploadImageField } from "@/components/upload-image-field";

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
  const [photoUrl, setPhotoUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const defaultChildId = children[0]?.id ?? "";

  async function submitContact(formData: FormData) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const temporary = Boolean(formData.get("temporary"));
      const data = await postJson("/api/parent/pickup-contacts", {
        child_id: String(formData.get("child_id") || ""),
        full_name: String(formData.get("full_name") || ""),
        relation: String(formData.get("relation") || "other"),
        phone: String(formData.get("phone") || "") || null,
        identity_number: String(formData.get("identity_number") || "") || null,
        face_reference_image: photoUrl || null,
        photo_required: Boolean(formData.get("photo_required")),
        temporary,
        valid_from: String(formData.get("valid_from") || "") || null,
        valid_until: String(formData.get("valid_until") || "") || null,
        notes: String(formData.get("notes") || "") || null
      });
      setContactRows((current) => [data, ...current]);
      setPhotoUrl("");
      setMessage(temporary ? "הרשאה זמנית נוצרה ונשלחה לגן" : "מורשה האיסוף נשמר");
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
      setContactRows((current) => current.map((row) => row.id === data.id ? data : row));
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
            <label>תעודת זהות<input name="identity_number" inputMode="numeric" /></label>
            <label><input type="checkbox" name="photo_required" /> דרושה תמונה לזיהוי מהיר</label>
            <label><input type="checkbox" name="temporary" /> הרשאה זמנית בלבד</label>
            <label>תקף מ<input name="valid_from" type="datetime-local" /></label>
            <label>תקף עד<input name="valid_until" type="datetime-local" /></label>
            <label className="wide">הערות<textarea name="notes" rows={3} /></label>
          </div>
          <div className="upload-card-field">
            <strong>תמונה אופציונלית</strong>
            {photoUrl ? <img className="profile-preview-image" src={photoUrl} alt="תמונת מורשה איסוף" /> : <small className="warning-text">מומלץ לצרף תמונה, אך אין אישור פנים אוטומטי.</small>}
            <UploadImageField label={photoUrl ? "החלפת תמונה" : "העלאת תמונה"} bucket="pickup-person-photos" prefix="pickup-authorizations" onUploaded={setPhotoUrl} />
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

export function GardenPickupVerificationPanel({ children, contacts, events }: { children: Row[]; contacts: Row[]; events: Row[] }) {
  const [eventRows, setEventRows] = useState(events);
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const contactsForChild = useMemo(() => contacts.filter((contact) => contact.child_id === selectedChildId && contact.active), [contacts, selectedChildId]);

  async function recordPickup(formData: FormData) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const contactId = String(formData.get("pickup_contact_id") || "");
      const selectedContact = contacts.find((contact) => contact.id === contactId);
      const data = await postJson("/api/garden/pickup-events", {
        child_id: selectedChildId,
        pickup_contact_id: contactId || null,
        pickup_person: selectedContact?.full_name || String(formData.get("pickup_person") || ""),
        authorization_type: selectedContact?.authorization_type || String(formData.get("authorization_type") || "manual_review"),
        status: Boolean(formData.get("unusual")) ? "unusual" : "verified_by_staff",
        notes: String(formData.get("notes") || "") || null,
        unusual_reason: String(formData.get("unusual_reason") || "") || null,
        request_parent_confirmation: Boolean(formData.get("request_parent_confirmation"))
      });
      setEventRows((current) => [data, ...current]);
      setMessage("אירוע האיסוף נרשם. אין שחרור אוטומטי - נדרש שיקול דעת צוות.");
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
        <form className="card form compact-form" action={recordPickup}>
          <div className="section-heading"><h2>רישום איסוף</h2><p>המערכת מציגה הרשאות, אבל הצוות מאשר בפועל. אין שחרור אוטומטי.</p></div>
          <div className="form-grid">
            <label>ילד/ה<select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)} required>{children.map((child) => <option value={child.id} key={child.id}>{child.full_name}</option>)}</select></label>
            <label>מורשה איסוף<select name="pickup_contact_id"><option value="">בחירה ידנית</option>{contactsForChild.map((contact) => <option value={contact.id} key={contact.id}>{contact.full_name} · {relationLabels[contact.relation] ?? contact.relation}</option>)}</select></label>
            <label>שם אוסף ידני<input name="pickup_person" placeholder="למקרה שלא נבחר מורשה" /></label>
            <label>סוג אישור<select name="authorization_type" defaultValue="manual_review"><option value="manual_review">בדיקה ידנית</option><option value="permanent">הרשאה קבועה</option><option value="temporary">הרשאה זמנית</option><option value="emergency">חירום</option><option value="unauthorized">לא מורשה</option></select></label>
            <label><input type="checkbox" name="unusual" /> סימון איסוף חריג</label>
            <label><input type="checkbox" name="request_parent_confirmation" /> בקשת אישור הורה</label>
            <label className="wide">סיבת חריגות<input name="unusual_reason" /></label>
            <label className="wide">הערות<textarea name="notes" rows={3} /></label>
          </div>
          <button className="button primary" disabled={busy || !selectedChildId}>רישום איסוף</button>
        </form>

        <article className="card action-panel">
          <div className="section-heading"><h2>מורשים לילד הנבחר</h2><p>תמונת reference היא לעזרה אנושית בלבד. אין face approval אוטומטי.</p></div>
          {contactsForChild.length === 0 ? <div className="empty-state"><strong>אין מורשי איסוף פעילים</strong><span>ניתן לבחור בדיקה ידנית ולבקש אישור הורה.</span></div> : contactsForChild.map((contact) => <div className="list-item" key={contact.id}><div><strong>{contact.full_name}</strong><span>{relationLabels[contact.relation] ?? contact.relation} · {contact.phone ?? "אין טלפון"}</span>{contact.valid_until ? <span>תקף עד {new Date(contact.valid_until).toLocaleString("he-IL")}</span> : null}</div><span className={contact.authorization_type === "temporary" ? "pill warn" : "pill good"}>{contact.authorization_type === "temporary" ? "זמני" : "קבוע"}</span></div>)}
        </article>
      </section>
      <section className="card action-panel">
        <div className="section-heading"><h2>אירועי איסוף אחרונים</h2><p>אירועים חריגים ובקשות אישור הורה מקבלים התראה.</p></div>
        {eventRows.length === 0 ? <div className="empty-state"><strong>אין איסופים חדשים</strong><span>רישום איסוף יופיע כאן.</span></div> : <div className="timeline-list">{eventRows.map((event) => <div className="timeline-item" key={event.id}><span className={event.status === "unusual" || event.authorization_type === "unauthorized" ? "severity-dot critical" : "severity-dot low"} /><div><strong>{event.children?.full_name ?? "ילד/ה"} · {event.pickup_person}</strong><small>{event.pickup_time ? new Date(event.pickup_time).toLocaleString("he-IL") : ""} · {event.status}</small>{event.parent_confirmation_requested ? <p className="warning-text"><ShieldAlert size={14} /> נשלחה בקשת אישור הורה</p> : null}{event.face_match_status === "not_run" ? <p><ShieldCheck size={14} /> זיהוי פנים לא הופעל. בדיקה אנושית בלבד.</p> : null}</div></div>)}</div>}
      </section>
    </div>
  );
}
