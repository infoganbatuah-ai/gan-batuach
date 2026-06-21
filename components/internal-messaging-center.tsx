"use client";

import { useState, useTransition } from "react";
import { MessageCircleReply } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CollapsibleActionPanel } from "@/components/collapsible-action-panel";

export function InternalMessagingCenter({
  gardenId,
  recipients,
  messages,
  linkedChildren = [],
  preselectedChildId,
  preselectedRecipientId,
  defaultOpen = false
}: {
  gardenId?: string | null;
  recipients: any[];
  messages: any[];
  linkedChildren?: any[];
  preselectedChildId?: string;
  preselectedRecipientId?: string;
  defaultOpen?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setMessage("");
    const payload = {
      garden_id: gardenId || undefined,
      recipient_id: String(formData.get("recipient_id") ?? "") || undefined,
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      content: String(formData.get("body") ?? ""),
      linked_child_id: String(formData.get("linked_child_id") ?? "") || undefined,
      status: "unread",
      treatment_status: "open"
    };
    startTransition(async () => {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage(response.ok ? "ההודעה נשלחה ונשמרה במערכת." : "לא ניתן לשלוח הודעה כרגע.");
    });
  }

  return (
    <section className="grid cols-2 dashboard-panels">
      <CollapsibleActionPanel title="הודעה חדשה" description="פתחו את הטופס רק כשצריך לשלוח הודעה. השיחות האחרונות נשארות זמינות בצד." buttonLabel="יצירת הודעה חדשה" defaultOpen={defaultOpen || messages.length === 0 || Boolean(preselectedChildId || preselectedRecipientId)}>
        {({ close }) => <form action={async (formData) => { await submit(formData); close(); }} className="card form wizard-form">
        <div className="section-heading"><h2><MessageCircleReply size={20} /> הודעה חדשה</h2><p>בחרו נמען, נושא ותוכן. ההודעה נשמרת עם סטטוס קריאה וטיפול.</p></div>
        {message ? <div className={message.includes("נשלחה") ? "success-banner" : "error-banner"}>{message}</div> : null}
        <div className="form-grid">
          {preselectedRecipientId ? <input type="hidden" name="recipient_id" value={preselectedRecipientId} /> : <label>נמען<select name="recipient_id" required><option value="">בחרו נמען</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.full_name ?? recipient.email ?? recipient.id} · {recipient.role ?? ""}</option>)}</select></label>}
          {preselectedChildId ? <input type="hidden" name="linked_child_id" value={preselectedChildId} /> : <label>ילד קשור<select name="linked_child_id"><option value="">לא משויך לילד</option>{linkedChildren.map((child) => <option value={child.id} key={child.id}>{child.full_name}</option>)}</select></label>}
          {preselectedChildId || preselectedRecipientId ? <div className="context-send-strip">שליחת הודעה בהקשר: {linkedChildren.find((child) => child.id === preselectedChildId)?.full_name ?? "ילד נבחר"} · {recipients.find((recipient) => recipient.id === preselectedRecipientId)?.full_name ?? "הורה משויך"}</div> : null}
          <label className="wide">נושא<input name="subject" required placeholder="לדוגמה: עדכון יומי / מסמך חסר / שאלה" /></label>
          <label className="wide">תוכן<textarea name="body" rows={5} required placeholder="כתבו ברור וקצר. הצד השני יראה את ההודעה באזור האישי." /></label>
        </div>
        <div className="profile-actions"><button className="button primary" disabled={isPending}>שליחת הודעה</button><button className="button secondary" type="button" onClick={close}>ביטול</button></div>
      </form>}
      </CollapsibleActionPanel>
      <article className="card action-panel">
        <div className="section-heading"><h2>שיחות אחרונות</h2><p>כולל סטטוס קריאה, נושא ותאריך.</p></div>
        {messages.length === 0 ? <div className="empty-state"><strong>אין הודעות עדיין</strong><span>לאחר שליחה או קבלה של הודעה, היא תופיע כאן.</span></div> : <div className="message-thread-list">{messages.map((item) => <div className="message-thread" key={item.id}><Avatar name={item.sender?.full_name ?? item.recipient?.full_name ?? "משתמש"} src={item.sender?.profile_image_url ?? item.recipient?.profile_image_url} /><div><strong>{item.subject}</strong><p>{item.content ?? item.body}</p><small>{item.created_at ? new Date(item.created_at).toLocaleString("he-IL") : ""} · {item.status ?? "unread"}</small></div></div>)}</div>}
      </article>
    </section>
  );
}
