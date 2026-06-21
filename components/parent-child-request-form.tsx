"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

type Recipient = { id: string; profile_id?: string | null; role: string; group: string; label: string };

const requestTypes = ["שאלה כללית", "בריאות / אלרגיה", "איסוף / שחרור", "תשלום", "יומן יומי", "תלונה", "מצלמות", "מסמכים", "אחר"];

function defaultGroup(type: string) {
  if (type.includes("בריאות")) return "manager";
  if (type.includes("איסוף")) return "staff";
  if (type.includes("תשלום")) return "owner";
  if (type.includes("יומן")) return "staff";
  if (type.includes("תלונה")) return "manager_admin";
  if (type.includes("מצלמות")) return "manager_admin";
  if (type.includes("מסמכים")) return "manager";
  return "manager";
}

export function ParentChildRequestForm({ children }: { children: any[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [childId, setChildId] = useState(children[0]?.id ?? "");
  const [requestType, setRequestType] = useState(requestTypes[0]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [context, setContext] = useState<{ child_name?: string; garden_name?: string } | null>(null);
  const [recipientValue, setRecipientValue] = useState("");
  const suggestedGroup = useMemo(() => defaultGroup(requestType), [requestType]);

  useEffect(() => {
    if (!childId) return;
    let active = true;
    fetch(`/api/parent/request-recipients?child_id=${encodeURIComponent(childId)}`)
      .then((response) => response.json())
      .then((body) => {
        if (!active) return;
        const data = body.data;
        setRecipients(data?.recipients ?? []);
        setContext({ child_name: data?.child_name, garden_name: data?.garden_name });
        const suggested = (data?.recipients ?? []).find((recipient: Recipient) => recipient.id === `group:${suggestedGroup}` || recipient.group === suggestedGroup);
        setRecipientValue(suggested?.id ?? "group:manager");
      })
      .catch(() => {
        if (active) setRecipients([]);
      });
    return () => { active = false; };
  }, [childId, suggestedGroup]);

  async function submit(formData: FormData) {
    setMessage("");
    const selected = recipients.find((recipient) => recipient.id === recipientValue);
    const isProfile = recipientValue.startsWith("profile:");
    const payload = {
      child_id: childId,
      request_type: requestType,
      content: String(formData.get("content") ?? ""),
      recipient_mode: isProfile ? "profile" : "group",
      recipient_profile_id: isProfile ? selected?.profile_id ?? "" : "",
      recipient_role_group: isProfile ? selected?.group ?? "" : recipientValue.replace("group:", ""),
      recipient_label: selected?.label ?? "",
      priority: ["תלונה", "מצלמות"].some((value) => requestType.includes(value)) ? "high" : "normal"
    };
    startTransition(async () => {
      const response = await fetch("/api/parent/child-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (response.ok) {
        setMessage("הפנייה נשלחה לנמען הרלוונטי ותופיע עם סטטוס טיפול.");
        router.refresh();
      } else {
        setMessage(body.error || "לא ניתן לשלוח בקשה כרגע.");
      }
    });
  }

  return (
    <form action={submit} className="parent-section-card parent-request-form">
      <div className="section-heading"><h2>פנייה חכמה לגן</h2><p>בחרו סוג פנייה ונמען. המערכת תציג רק אנשי קשר רלוונטיים לגן של הילד ותשלח התראה למי שצריך לטפל.</p></div>
      {message ? <div className={message.includes("נשלחה") ? "success-banner" : "error-banner"}>{message}</div> : null}
      <label>ילד<select name="child_id" value={childId} onChange={(event) => setChildId(event.target.value)} required>{children.map((child) => <option value={child.id} key={child.id}>{child.full_name}</option>)}</select></label>
      {context ? <div className="context-send-strip">פנייה עבור: {context.child_name} · לגן: {context.garden_name}</div> : null}
      <label>סוג פנייה<select name="request_type" value={requestType} onChange={(event) => setRequestType(event.target.value)}>{requestTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>למי תרצה לשלוח את הפנייה?<select value={recipientValue} onChange={(event) => setRecipientValue(event.target.value)} required><option value="">בחרו נמען</option>{recipients.map((recipient) => <option value={recipient.id} key={recipient.id}>{recipient.label}</option>)}</select></label>
      <small className="helper-text">המלצה לפי סוג הפנייה: {recipients.find((recipient) => recipient.id === `group:${suggestedGroup}` || recipient.group === suggestedGroup)?.label ?? "מנהלת הגן"}. אפשר לשנות אם צריך.</small>
      <label>תוכן<textarea name="content" rows={3} required placeholder="כתבו בקשה ברורה וקצרה. ההורה והנמען יראו סטטוס טיפול." /></label>
      <button className="button primary" disabled={pending || children.length === 0 || !recipientValue} type="submit"><Send size={15} /> שליחת פנייה</button>
    </form>
  );
}
