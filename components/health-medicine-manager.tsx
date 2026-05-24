"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, HeartPulse, Pill } from "lucide-react";
import { Avatar } from "@/components/avatar";

export function HealthMedicineManager({ gardenId, children, records }: { gardenId: string; children: any[]; records: any[] }) {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectedChild = children.find((child) => child.id === selectedChildId);
  const selectedRecord = records.find((record) => record.child_id === selectedChildId);

  async function save(formData: FormData) {
    setMessage("");
    const emergency_contacts = String(formData.get("emergency_contacts") ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name, phone, relation] = line.split(",").map((part) => part?.trim());
      return { name, phone, relation };
    });
    const payload = {
      garden_id: gardenId,
      child_id: String(formData.get("child_id")),
      hmo: String(formData.get("hmo") ?? ""),
      allergies: String(formData.get("allergies") ?? ""),
      sensitivities: String(formData.get("sensitivities") ?? ""),
      medications: String(formData.get("medications") ?? ""),
      emergency_contacts,
      medication_approval_url: String(formData.get("medication_approval_url") ?? ""),
      medication_approval_expires_at: String(formData.get("medication_approval_expires_at") ?? ""),
      medical_notes: String(formData.get("medical_notes") ?? ""),
      medication_due_at: String(formData.get("medication_due_at") ?? "") || undefined
    };
    startTransition(async () => {
      const response = await fetch("/api/child-health-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage(response.ok ? "המידע הרפואי נשמר." : "לא ניתן לשמור מידע רפואי כרגע.");
    });
  }

  async function logMedicine(formData: FormData) {
    setMessage("");
    const payload = { garden_id: gardenId, child_id: selectedChildId, medicine_name: String(formData.get("medicine_name") ?? ""), dosage: String(formData.get("dosage") ?? ""), approval_checked: Boolean(formData.get("approval_checked")), notes: String(formData.get("notes") ?? "") };
    startTransition(async () => {
      const response = await fetch("/api/medicine-given-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage(response.ok ? "מתן תרופה נרשם ביומן." : "לא ניתן לרשום תרופה כרגע.");
    });
  }

  return (
    <section className="grid cols-2 dashboard-panels">
      <article className="card action-panel">
        <div className="section-heading"><h2>אזהרות בריאות</h2><p>אלרגיות, תרופות ומידע חסר שדורש טיפול לפני יום פעילות.</p></div>
        <div className="child-card-list">{children.length === 0 ? <div className="empty-state"><strong>אין ילדים להצגה</strong><span>אחרי אישור ילדים, פרטי הבריאות שלהם יופיעו כאן.</span></div> : children.map((child) => {
          const record = records.find((item) => item.child_id === child.id);
          return <button className={selectedChildId === child.id ? "child-card active" : "child-card"} type="button" key={child.id} onClick={() => setSelectedChildId(child.id)}>
            <Avatar name={child.full_name} src={child.photo_url} />
            <span><strong>{child.full_name}</strong><small>{record?.hmo ?? child.hmo ?? "קופה לא צוינה"}</small></span>
            {record?.allergy_warning || child.allergies ? <b className="pill bad"><AlertTriangle size={13} /> אלרגיה</b> : record?.missing_info ? <b className="pill warn">חסר מידע</b> : <b className="pill good">תקין</b>}
          </button>;
        })}</div>
      </article>

      <div className="stacked-panels">
        <form action={save} className="card form wizard-form">
          <div className="section-heading"><h2><HeartPulse size={20} /> כרטיס בריאות</h2><p>מידע רפואי רגיש. מוצג רק לבעלי הרשאה בגן.</p></div>
          {message ? <div className={message.includes("נשמר") || message.includes("נרשם") ? "success-banner" : "error-banner"}>{message}</div> : null}
          <input type="hidden" name="child_id" value={selectedChildId} />
          <div className="selected-child-strip"><Avatar name={selectedChild?.full_name} src={selectedChild?.photo_url} /><strong>{selectedChild?.full_name ?? "בחרו ילד"}</strong></div>
          <div className="form-grid">
            <label>קופת חולים<input name="hmo" defaultValue={selectedRecord?.hmo ?? selectedChild?.hmo ?? ""} /></label>
            <label>תוקף אישור תרופה<input name="medication_approval_expires_at" type="date" defaultValue={selectedRecord?.medication_approval_expires_at ?? ""} /></label>
            <label className="wide">אלרגיות<textarea name="allergies" rows={2} defaultValue={selectedRecord?.allergies ?? selectedChild?.allergies ?? ""} /></label>
            <label className="wide">רגישויות<textarea name="sensitivities" rows={2} defaultValue={selectedRecord?.sensitivities ?? selectedChild?.sensitivities ?? ""} /></label>
            <label className="wide">תרופות קבועות<textarea name="medications" rows={2} defaultValue={selectedRecord?.medications ?? selectedChild?.regular_medications ?? ""} /></label>
            <label className="wide">אנשי קשר חירום<textarea name="emergency_contacts" rows={3} placeholder="שם, טלפון, קשר משפחתי - כל איש קשר בשורה" /></label>
            <label>קישור אישור תרופה<input name="medication_approval_url" defaultValue={selectedRecord?.medication_approval_url ?? ""} /></label>
            <label>מועד תרופה הבא<input name="medication_due_at" type="datetime-local" /></label>
            <label className="wide">הערות רפואיות<textarea name="medical_notes" rows={3} defaultValue={selectedRecord?.medical_notes ?? selectedChild?.medical_notes ?? ""} /></label>
          </div>
          <button className="button primary" disabled={isPending || !selectedChildId}>שמירת כרטיס בריאות</button>
        </form>
        <form action={logMedicine} className="card form compact-form">
          <h3><Pill size={18} /> רישום מתן תרופה</h3>
          <div className="form-grid"><label>שם תרופה<input name="medicine_name" required /></label><label>מינון<input name="dosage" /></label><label className="wide"><input name="approval_checked" type="checkbox" required /> נבדק אישור הורה בתוקף</label><label className="wide">הערה<input name="notes" /></label></div>
          <button className="button secondary" disabled={isPending || !selectedChildId}>רישום תרופה</button>
        </form>
      </div>
    </section>
  );
}
