"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Baby, PlusCircle, Send } from "lucide-react";
import { Avatar } from "@/components/avatar";

type ChildOption = {
  id: string;
  permanent_child_file_id?: string | null;
  full_name: string;
  birth_date?: string | null;
  photo_url?: string | null;
  face_image_url?: string | null;
  garden_id?: string | null;
  kindergarten_id?: string | null;
  garden_name?: string | null;
  status?: string | null;
};

type GardenOption = {
  id: string;
  name?: string | null;
  city?: string | null;
};

export function ParentAdditionalChildRequestForm({
  gardenName,
  children = [],
  gardens = [],
  defaultGardenId
}: {
  gardenName?: string | null;
  children?: ChildOption[];
  gardens?: GardenOption[];
  defaultGardenId?: string | null;
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"existing_child" | "new_child">(children.length ? "existing_child" : "new_child");
  const [selectedChildRef, setSelectedChildRef] = useState<string>(children[0]?.permanent_child_file_id ?? children[0]?.id ?? "");

  async function submit(formData: FormData) {
    setMessage("");
    const payload = {
      mode,
      target_garden_id: String(formData.get("target_garden_id") ?? ""),
      existing_child_ref: mode === "existing_child" ? selectedChildRef : undefined,
      child_name: String(formData.get("child_name") ?? ""),
      child_age: String(formData.get("child_age") ?? ""),
      requested_start_date: String(formData.get("requested_start_date") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "")
    };

    startTransition(async () => {
      const response = await fetch("/api/parent/child-transfer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.error ?? "לא ניתן לשלוח בקשה כרגע.");
        return;
      }
      setMessage(mode === "existing_child"
        ? "בקשת הקליטה נשלחה לגן החדש. תיק הילד נשמר, והגן החדש יבדוק את הפרטים לפני אישור."
        : "בקשת הרישום נשלחה לגן. לאחר אישור המנהלת ייפתח כרטיס השלמת פרטים לילד החדש.");
    });
  }

  return (
    <form id="add-child-request" action={submit} className="parent-section-card parent-request-form warm-request-card">
      <div className="section-heading">
        <h2><Baby size={18} /> בקשת רישום / מעבר ילד</h2>
        <p>אם זה ילד שכבר קיים בחשבון, נשתמש בתיק הילד הקבוע ולא נבקש למלא הכל מחדש. אם זה ילד חדש, נפתח בקשת רישום רגילה.</p>
      </div>
      {message ? <div className={message.includes("נשלחה") ? "success-banner" : "error-banner"}>{message}</div> : null}
      <label>לאיזה גן לשלוח את הבקשה?
        <select name="target_garden_id" required defaultValue={defaultGardenId ?? gardens[0]?.id ?? ""}>
          {gardens.length === 0 ? <option value="">אין גנים זמינים לבחירה</option> : gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name ?? "גן ילדים"}{garden.city ? ` · ${garden.city}` : ""}</option>)}
        </select>
      </label>
      <div className="segmented-control">
        <button type="button" className={mode === "existing_child" ? "active" : ""} onClick={() => setMode("existing_child")} disabled={children.length === 0}><ArrowLeftRight size={15} /> בחירת ילד קיים</button>
        <button type="button" className={mode === "new_child" ? "active" : ""} onClick={() => setMode("new_child")}><PlusCircle size={15} /> יצירת ילד חדש</button>
      </div>
      {mode === "existing_child" ? (
        <div className="existing-child-picker">
          <h3>איזה ילד תרצו לרשום לגן החדש?</h3>
          {children.length === 0 ? <div className="empty-mini">אין עדיין ילדים בחשבון. בחרו “יצירת ילד חדש”.</div> : children.map((child) => {
            const ref = child.permanent_child_file_id ?? child.id;
            return (
              <button type="button" className={selectedChildRef === ref ? "child-picker-card selected" : "child-picker-card"} key={ref} onClick={() => setSelectedChildRef(ref)}>
                <Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="sm" />
                <span><strong>{child.full_name}</strong><small>{child.birth_date ? new Date(child.birth_date).toLocaleDateString("he-IL") : "תאריך לידה לא צוין"} · {child.garden_name ?? gardenName ?? "גן נוכחי"} · {child.status ?? "סטטוס לא צוין"}</small></span>
              </button>
            );
          })}
          <p className="form-help">לא ניצור תיק ילד חדש. הבקשה תשתמש בתיק הקיים, בבריאות, בתמונות ובאנשי הקשר שכבר שמורים.</p>
        </div>
      ) : (
        <>
          <label>שם הילד/ה<input name="child_name" required={mode === "new_child"} placeholder="לדוגמה: נועה כהן" /></label>
          <label>גיל / תאריך לידה משוער<input name="child_age" placeholder="לדוגמה: 2.5 או 12/04/2023" /></label>
        </>
      )}
      <label>תאריך התחלה מבוקש<input name="requested_start_date" type="date" /></label>
      <label>הערות למנהלת<textarea name="notes" rows={3} placeholder={mode === "existing_child" ? "מה חשוב לגן החדש לדעת לפני קליטת הילד?" : "מה חשוב שהגן ידע לפני פתיחת כרטיס חדש?"} /></label>
      <button className="button primary" disabled={pending} type="submit"><Send size={15} /> שליחת בקשה לגן</button>
    </form>
  );
}
