"use client";

import { useState, useTransition } from "react";
import { Siren } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CollapsibleActionPanel } from "@/components/collapsible-action-panel";
import { uploadFiles } from "@/lib/client-upload";

const incidentTypes = [
  ["injury", "פציעה"],
  ["fall", "נפילה"],
  ["violence", "אלימות"],
  ["crying", "בכי חריג"],
  ["complaint", "תלונה"],
  ["staff_absence", "היעדרות צוות"],
  ["camera_issue", "תקלה במצלמה"],
  ["safety_issue", "חריג בטיחות"],
  ["medical_issue", "אירוע רפואי"],
  ["parent_complaint", "תלונת הורה"]
];

export function IncidentManager({ gardenId, children, incidents }: { gardenId: string; children: any[]; incidents: any[] }) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setMessage("");
    let uploadedPhotos: string[] = [];
    try {
      uploadedPhotos = await uploadFiles(formData.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0), "incident-photos", "incidents");
    } catch (error) {
      console.error("Incident photo upload failed", error);
      setMessage("לא ניתן להעלות תמונות כרגע. האירוע לא נשמר כדי למנוע תיעוד חלקי.");
      return;
    }
    const payload = {
      garden_id: gardenId,
      child_id: String(formData.get("child_id") ?? "") || undefined,
      incident_type: String(formData.get("incident_type")),
      title: String(formData.get("title")),
      description: String(formData.get("description")),
      severity: String(formData.get("severity")),
      parent_notified: Boolean(formData.get("parent_notified")),
      inspector_notified: Boolean(formData.get("inspector_notified")),
      photo_urls: uploadedPhotos
    };
    startTransition(async () => {
      const response = await fetch("/api/incident-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage(response.ok ? "האירוע נשמר ונכנס לציר הטיפול." : "לא ניתן לשמור אירוע כרגע.");
    });
  }

  return (
    <section className="grid cols-2 dashboard-panels">
      <CollapsibleActionPanel title="דיווח אירוע חדש" description="אירועים קיימים מוצגים בציר. פתחו טופס רק כשצריך לתעד אירוע חדש." buttonLabel="פתיחת אירוע חדש" defaultOpen={incidents.length === 0}>
        {({ close }) => <form action={async (formData) => { await submit(formData); close(); }} className="card form wizard-form">
        <div className="section-heading"><h2><Siren size={20} /> דיווח אירוע</h2><p>תעדו מה קרה, מי עודכן ומה נדרש להמשך טיפול.</p></div>
        {message ? <div className={message.includes("נשמר") ? "success-banner" : "error-banner"}>{message}</div> : null}
        <div className="form-grid">
          <label>סוג אירוע<select name="incident_type">{incidentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>ילד/ה קשור/ה<select name="child_id"><option value="">לא משויך לילד</option>{children.map((child) => <option key={child.id} value={child.id}>{child.full_name}</option>)}</select></label>
          <label>חומרה<select name="severity"><option value="low">נמוכה</option><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="critical">קריטית</option></select></label>
          <label>כותרת<input name="title" required placeholder="לדוגמה: נפילה בחצר" /></label>
          <label className="wide">תיאור<textarea name="description" rows={5} required placeholder="מה קרה, מתי, מי היה נוכח ומה נעשה מיד" /></label>
          <label className="wide">תמונות אירוע<input name="photos" type="file" accept="image/*" multiple /></label>
          <label><input type="checkbox" name="parent_notified" /> הורה עודכן</label>
          <label><input type="checkbox" name="inspector_notified" /> פקח עודכן</label>
        </div>
        <div className="profile-actions"><button className="button primary" disabled={isPending}>שמירת אירוע</button><button className="button secondary" type="button" onClick={close}>ביטול</button></div>
      </form>}
      </CollapsibleActionPanel>
      <article className="card action-panel">
        <div className="section-heading"><h2>ציר אירועים פתוחים</h2><p>כל אירוע נשמר עם מדווח, סטטוס והמשך טיפול.</p></div>
        {incidents.length === 0 ? <div className="empty-state"><strong>אין אירועים פתוחים</strong><span>אירועי בטיחות, רפואה, מצלמות ותלונות יופיעו כאן.</span></div> : <div className="timeline-list">{incidents.map((incident) => <div className="timeline-item" key={incident.id}><span className={`severity-dot ${incident.severity}`} /><div><strong>{incident.title}</strong><small>{incident.incident_type} · {incident.status} · {new Date(incident.created_at).toLocaleString("he-IL")}</small><p>{incident.description}</p>{incident.children ? <span className="selected-child-strip mini"><Avatar name={incident.children.full_name} src={incident.children.photo_url} /> {incident.children.full_name}</span> : null}</div></div>)}</div>}
      </article>
    </section>
  );
}
