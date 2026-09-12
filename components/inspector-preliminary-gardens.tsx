"use client";

import { useEffect, useState, type FormEvent } from "react";

type Draft = { id: string; name: string; city: string; status: string; onboarding_status: string; invitation_status: string | null; bootstrap_assignment_status: string | null; bootstrap_cancelled_at: string | null };

export function InspectorPreliminaryGardens() {
  const [gardens, setGardens] = useState<Draft[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState("owner_only");
  const [selected, setSelected] = useState("");
  async function refresh() {
    const response = await fetch("/api/inspector/preliminary-gardens", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "לא ניתן להציג טיוטות גן.");
    setGardens(body.data.gardens);
  }
  useEffect(() => {
    fetch("/api/inspector/preliminary-gardens", { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "לא ניתן להציג טיוטות גן."); setGardens(body.data.gardens); })
      .catch(error => setMessage(error.message));
  }, []);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/inspector/preliminary-gardens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, city, address }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן ליצור טיוטה.");
      setSelected(body.data.garden_id); setMessage("טיוטת הגן נוצרה. אפשר לשלוח הזמנה אישית."); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "הפעולה נכשלה."); }
    finally { setBusy(false); }
  }
  async function invite(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/inspector/preliminary-gardens/${selected}/invitation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipient_email: email, registrant_type: kind }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן ליצור הזמנה.");
      setMessage(body.data.delivery_status === "sent" ? "ההזמנה נשלחה." : "ההזמנה נוצרה, אך מסירה חיצונית טרם אומתה."); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "הפעולה נכשלה."); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/inspector/preliminary-gardens/${id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לבטל את הטיוטה.");
      if (selected === id) setSelected("");
      setMessage("הטיוטה בוטלה והזמנות פתוחות בוטלו."); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "הפעולה נכשלה."); }
    finally { setBusy(false); }
  }
  return <main className="section" dir="rtl"><h1>הקמת גן דרך מפקח</h1><p>טיוטת הגן אינה פעילה ואינה מוצגת להורים. בעל/ת הגן או הגננת ישלימו את הקליטה לאחר קבלת הזמנה מאובטחת.</p>
    {message && <p role="status">{message}</p>}
    <form className="card" onSubmit={create}><h2>טיוטת גן חדשה</h2><label>שם הגן<input required minLength={2} value={name} onChange={event => setName(event.target.value)} /></label><label>עיר<input required minLength={2} value={city} onChange={event => setCity(event.target.value)} /></label><label>כתובת, אם ידועה<input value={address} onChange={event => setAddress(event.target.value)} /></label><button className="button primary" disabled={busy}>יצירת טיוטה</button></form>
    <section><h2>גנים שהתחלתי</h2>{gardens.length === 0 ? <p>טרם נוצרו טיוטות.</p> : gardens.map(garden => <article className="card" key={garden.id}><h3>{garden.name} · {garden.city}</h3><p>{garden.status === "active" ? "גן פעיל" : garden.bootstrap_cancelled_at ? "טיוטה בוטלה" : garden.invitation_status === "accepted" ? "האונבורדינג בתהליך" : garden.invitation_status === "rejected" ? "ההזמנה נדחתה" : garden.invitation_status ? `הזמנה: ${garden.invitation_status}` : "ממתין להזמנה"}</p>{garden.bootstrap_assignment_status === "admin_reassignment_required" && <p>נדרש שיוך מפקח בידי אדמין.</p>}{garden.status === "pending" && !garden.bootstrap_cancelled_at && <><button className="button secondary" type="button" onClick={() => setSelected(garden.id)}>הזמנת בעלים או גננת</button>{!garden.invitation_status || ["pending", "delivered", "rejected", "expired"].includes(garden.invitation_status) ? <button className="button secondary" type="button" disabled={busy} onClick={() => void cancel(garden.id)}>ביטול טיוטה</button> : null}</>}</article>)}</section>
    {selected && <form className="card" onSubmit={invite}><h2>הזמנה אישית</h2><label>דוא״ל הנמען<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>תפקיד<select value={kind} onChange={event => setKind(event.target.value)}><option value="owner_only">בעלים</option><option value="owner_teacher">בעלים וגננת</option><option value="teacher_operator">גננת מפעילה</option></select></label><button className="button primary" disabled={busy}>יצירת ושליחת הזמנה</button></form>}
  </main>;
}
