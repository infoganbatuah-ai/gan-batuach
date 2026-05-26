"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";

export function ParentChildRequestForm({ children }: { children: any[] }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setMessage("");
    const payload = {
      child_id: String(formData.get("child_id") ?? ""),
      request_type: String(formData.get("request_type") ?? ""),
      content: String(formData.get("content") ?? "")
    };
    startTransition(async () => {
      const response = await fetch("/api/parent/child-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage(response.ok ? "הבקשה נשלחה לגן ותופיע בכרטיס הילד." : "לא ניתן לשלוח בקשה כרגע.");
    });
  }

  return (
    <form action={submit} className="card action-panel parent-request-form">
      <div className="section-heading"><h2>בקשה מיוחדת לגן</h2><p>בקשה זו תופיע בכרטיס הילד אצל המנהלת ותישמר עם סטטוס טיפול.</p></div>
      {message ? <div className={message.includes("נשלחה") ? "success-banner" : "error-banner"}>{message}</div> : null}
      <label>ילד<select name="child_id" required>{children.map((child) => <option value={child.id} key={child.id}>{child.full_name}</option>)}</select></label>
      <label>סוג בקשה<select name="request_type"><option>בריאות</option><option>איסוף</option><option>אוכל</option><option>שינה</option><option>מסמך</option><option>אחר</option></select></label>
      <label>תוכן<textarea name="content" rows={3} required placeholder="כתבו בקשה ברורה וקצרה לצוות הגן" /></label>
      <button className="button primary" disabled={pending || children.length === 0} type="submit"><Send size={15} /> שליחה לגן</button>
    </form>
  );
}
