"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCheck, FileText, MessageCircleReply, Paperclip, Search, Send, UsersRound, X } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Recipient = { id: string; full_name?: string | null; email?: string | null; role?: string | null; profile_image_url?: string | null };
type ChildOption = { id: string; full_name?: string | null };
type SeedMessage = {
  id?: string; thread_id?: string; garden_id?: string | null; child_id?: string | null; subject?: string | null;
  status?: string | null; treatment_status?: string | null; created_at?: string | null; content?: string | null;
  body?: string | null; sender_id?: string | null; recipient_id?: string | null;
  sender?: { full_name?: string | null; profile_image_url?: string | null; role?: string | null } | null;
  recipient?: { full_name?: string | null; profile_image_url?: string | null; role?: string | null } | null;
};
type Participant = { profile_id: string; role?: string | null; participant_label?: string | null; last_read_at?: string | null };
type Thread = {
  id: string; garden_id?: string | null; child_id?: string | null; classroom_id?: string | null;
  thread_type?: string | null; subject: string; status?: string | null; last_message_at?: string | null;
  created_at?: string | null; communication_thread_participants?: Participant[];
  preview?: string | null; seedAvatar?: string | null;
};
type ThreadDetail = {
  thread: Thread;
  messages: Array<{ id: string; sender_id: string; body?: string | null; content?: string | null; created_at?: string | null; message_kind?: string | null }>;
  attachments: Array<{ id: string; message_id: string; file_name: string; content_type: string; size_bytes: number; download_path: string }>;
};

function roleLabel(role?: string | null) {
  return role === "parent" ? "הורה" : role === "staff" ? "צוות" : role === "owner" ? "בעלים" : role === "manager" ? "מנהלת" : "משתמש";
}

function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

function seedFromMessages(messages: SeedMessage[]): Thread[] {
  const seen = new Set<string>();
  return messages.flatMap((item) => {
    const id = item.thread_id || item.id;
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const person = item.sender ?? item.recipient;
    return [{
      id, garden_id: item.garden_id, child_id: item.child_id,
      subject: item.subject || "שיחה עם הגן",
      status: item.status || item.treatment_status || "open",
      last_message_at: item.created_at, created_at: item.created_at,
      preview: item.content || item.body, seedAvatar: person?.profile_image_url,
      communication_thread_participants: person ? [{ profile_id: item.sender_id || item.recipient_id || "", role: person.role, participant_label: person.full_name }] : []
    }];
  });
}

export function InternalMessagingCenter({
  gardenId, currentProfileId, recipients, messages, linkedChildren = [],
  preselectedChildId, preselectedRecipientId, defaultOpen = false
}: {
  gardenId?: string | null; currentProfileId?: string; recipients: Recipient[]; messages: SeedMessage[];
  linkedChildren?: ChildOption[]; preselectedChildId?: string; preselectedRecipientId?: string; defaultOpen?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [threads, setThreads] = useState<Thread[]>(() => seedFromMessages(messages));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [composeOpen, setComposeOpen] = useState(defaultOpen || Boolean(preselectedChildId || preselectedRecipientId) || messages.length === 0);
  const [feedback, setFeedback] = useState("");
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    fetch("/api/communication/threads", { headers: { Accept: "application/json" } })
      .then(async (response) => response.ok ? (await response.json()).data as Thread[] : [])
      .then((data) => { if (active && data.length) setThreads(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    fetch(`/api/communication/threads/${selectedId}`, { headers: { Accept: "application/json" } })
      .then(async (response) => response.ok ? (await response.json()).data as ThreadDetail : null)
      .then((data) => {
        if (!active || !data) return;
        setDetail(data);
        void fetch(`/api/communication/threads/${selectedId}/read`, { method: "POST" });
        setThreads((current) => current.map((thread) => thread.id === selectedId
          ? { ...thread, communication_thread_participants: thread.communication_thread_participants?.map((participant) => participant.profile_id === currentProfileId ? { ...participant, last_read_at: new Date().toISOString() } : participant) }
          : thread));
      })
      .catch(() => { if (active) setFeedback("לא ניתן לטעון את השיחה כרגע."); });
    return () => { active = false; };
  }, [selectedId, currentProfileId]);

  const filtered = useMemo(() => threads.filter((thread) => {
    const participant = thread.communication_thread_participants?.find((item) => item.profile_id !== currentProfileId);
    const matches = `${thread.subject} ${participant?.participant_label ?? ""} ${thread.preview ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const self = thread.communication_thread_participants?.find((item) => item.profile_id === currentProfileId);
    const unread = Boolean(thread.last_message_at && (!self?.last_read_at || new Date(self.last_read_at) < new Date(thread.last_message_at)));
    return matches && (filter === "all" || unread);
  }), [threads, query, filter, currentProfileId]);

  async function uploadAttachment(threadId: string, messageId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/communication/threads/${threadId}/messages/${messageId}/attachments`, { method: "POST", body: form });
    if (!response.ok) throw new Error((await response.json()).error || "שמירת הקובץ נכשלה.");
  }

  function createThread(formData: FormData) {
    setFeedback("");
    const file = formData.get("attachment");
    const payload = {
      garden_id: gardenId || undefined,
      recipient_id: String(formData.get("recipient_id") ?? "") || undefined,
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      child_id: String(formData.get("linked_child_id") ?? "") || undefined
    };
    startTransition(async () => {
      const response = await fetch("/api/communication/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) { setFeedback(body.error || "לא ניתן לשלוח הודעה כרגע."); return; }
      try {
        if (file instanceof File && file.size) await uploadAttachment(body.data.thread_id, body.data.message_id, file);
        setFeedback(file instanceof File && file.size ? "ההודעה והקובץ נשלחו בערוץ הפרטי." : "ההודעה נשלחה ונשמרה במערכת.");
        setComposeOpen(false);
        setDetail(null);
        setSelectedId(body.data.thread_id);
        router.refresh();
      } catch (error) { setFeedback(error instanceof Error ? error.message : "הקובץ לא נשלח."); }
    });
  }

  function sendReply() {
    if (!selectedId || !reply.trim()) return;
    const pendingFile = attachment;
    const body = reply.trim();
    setReply(""); setAttachment(null); setFeedback("");
    startTransition(async () => {
      const response = await fetch(`/api/communication/threads/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ body })
      });
      const result = await response.json();
      if (!response.ok) { setReply(body); setAttachment(pendingFile); setFeedback(result.error || "שליחת ההודעה נכשלה."); return; }
      try {
        if (pendingFile) await uploadAttachment(selectedId, result.data.message_id, pendingFile);
        const refreshed = await fetch(`/api/communication/threads/${selectedId}`).then((res) => res.json());
        if (refreshed.data) setDetail(refreshed.data);
        setFeedback(pendingFile ? "ההודעה והקובץ נשלחו." : "ההודעה נשלחה.");
      } catch (error) { setFeedback(error instanceof Error ? error.message : "הקובץ לא נשלח."); }
    });
  }

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;
  const selectedParticipant = selected?.communication_thread_participants?.find((item) => item.profile_id !== currentProfileId);

  return (
    <section className={`communication-workspace ${selectedId ? "has-active-thread" : ""}`} dir="rtl">
      <aside className="communication-thread-pane" aria-label="רשימת שיחות">
        <div className="communication-pane-header">
          <div><span className="eyebrow">תקשורת מאובטחת</span><h2>הודעות</h2></div>
          <button className="communication-compose-button" type="button" onClick={() => setComposeOpen(true)} aria-label="הודעה חדשה"><MessageCircleReply size={20} /><span>הודעה חדשה</span></button>
        </div>
        <label className="communication-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש בשיחות..." aria-label="חיפוש בשיחות" /></label>
        <div className="communication-filter-tabs" role="tablist" aria-label="מסנן שיחות">
          <button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>הכל <b>{threads.length}</b></button>
          <button className={filter === "unread" ? "active" : ""} type="button" onClick={() => setFilter("unread")}>לא נקראו</button>
        </div>
        <div className="communication-thread-scroll">
          {filtered.length ? filtered.map((thread) => {
            const participant = thread.communication_thread_participants?.find((item) => item.profile_id !== currentProfileId);
            const self = thread.communication_thread_participants?.find((item) => item.profile_id === currentProfileId);
            const unread = Boolean(thread.last_message_at && (!self?.last_read_at || new Date(self.last_read_at) < new Date(thread.last_message_at)));
            return <button className={`communication-thread-row ${thread.id === selectedId ? "active" : ""}`} type="button" key={thread.id} onClick={() => { setDetail(null); setSelectedId(thread.id); }}>
              <Avatar name={participant?.participant_label ?? thread.subject} src={thread.seedAvatar} />
              <span className="communication-thread-copy"><strong>{participant?.participant_label ?? thread.subject}</strong><small>{roleLabel(participant?.role)} · {thread.subject}</small><em>{thread.preview ?? (thread.thread_type?.includes("broadcast") ? "הודעת גן" : "פתחו לצפייה בשיחה")}</em></span>
              <span className="communication-thread-meta"><time>{dateLabel(thread.last_message_at)}</time>{unread ? <i aria-label="לא נקרא">•</i> : <CheckCheck size={15} aria-label="נקרא" />}</span>
            </button>;
          }) : <div className="communication-empty"><UsersRound size={34} /><strong>{filter === "unread" ? "כל ההודעות נקראו" : "אין עדיין שיחות"}</strong><span>אפשר לפתוח שיחה חדשה עם נמען מורשה.</span></div>}
        </div>
      </aside>

      <article className="communication-conversation-pane" aria-label="תוכן השיחה">
        {selected ? <>
          <header className="communication-conversation-header">
            <button className="communication-mobile-back" type="button" onClick={() => setSelectedId(null)} aria-label="חזרה לרשימת השיחות"><ArrowRight size={22} /></button>
            <Avatar name={selectedParticipant?.participant_label ?? selected.subject} />
            <div><strong>{selectedParticipant?.participant_label ?? selected.subject}</strong><span>{selected.subject} · {roleLabel(selectedParticipant?.role)}</span></div>
            <span className="communication-secure-chip"><CheckCheck size={16} /> שיחה פרטית</span>
          </header>
          <div className="communication-message-scroll" aria-live="polite">
            {detail ? detail.messages.map((message) => {
              const mine = message.sender_id === currentProfileId;
              const messageAttachments = detail.attachments.filter((item) => item.message_id === message.id);
              return <div className={`communication-message-line ${mine ? "mine" : "theirs"}`} key={message.id}>
                <div className="communication-message-bubble"><p>{message.body ?? message.content}</p>{messageAttachments.map((item) => <a className="communication-attachment" href={item.download_path} key={item.id}><FileText size={17} /><span>{item.file_name}</span><small>{Math.ceil(item.size_bytes / 1024)} KB</small></a>)}<time>{dateLabel(message.created_at)} {mine ? <CheckCheck size={14} /> : null}</time></div>
              </div>;
            }) : <div className="communication-loading"><span /><span /><span /> טוען שיחה...</div>}
          </div>
          <footer className="communication-composer">
            {attachment ? <div className="communication-file-preview"><Paperclip size={16} /><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="הסרת קובץ"><X size={16} /></button></div> : null}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
            <button className="communication-icon-button" type="button" onClick={() => fileRef.current?.click()} aria-label="צירוף קובץ"><Paperclip size={21} /></button>
            <label><span className="sr-only">כתיבת הודעה</span><textarea rows={1} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="כתבו הודעה..." onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendReply(); } }} /></label>
            <button className="communication-send-button" type="button" onClick={sendReply} disabled={isPending || !reply.trim()} aria-label="שליחת הודעה"><Send size={20} /></button>
          </footer>
        </> : <div className="communication-conversation-empty"><MessageCircleReply size={48} /><h3>בוחרים שיחה וממשיכים מכאן</h3><p>הודעות, קבצים וסטטוס קריאה נשמרים רק למשתתפים המורשים.</p><button className="button primary" type="button" onClick={() => setComposeOpen(true)}>פתיחת שיחה חדשה</button></div>}
      </article>

      {composeOpen ? <div className="communication-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposeOpen(false); }}>
        <form className="communication-compose-modal" action={createThread} aria-label="הודעה חדשה">
          <div className="communication-modal-head"><div><span className="eyebrow">הודעה חדשה</span><h2>פותחים שיחה</h2><p>הנמען והקשר נבדקים שוב בשרת לפני השליחה.</p></div><button type="button" onClick={() => setComposeOpen(false)} aria-label="סגירה"><X /></button></div>
          <div className="communication-form-grid">
            {preselectedRecipientId ? <input type="hidden" name="recipient_id" value={preselectedRecipientId} /> : <label>נמען<select name="recipient_id" required defaultValue=""><option value="" disabled>בחרו נמען מורשה</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.full_name ?? recipient.email ?? recipient.id} · {roleLabel(recipient.role)}</option>)}</select></label>}
            {preselectedChildId ? <input type="hidden" name="linked_child_id" value={preselectedChildId} /> : <label>הקשר לילד<select name="linked_child_id" defaultValue=""><option value="">ללא שיוך לילד</option>{linkedChildren.map((child) => <option value={child.id} key={child.id}>{child.full_name}</option>)}</select></label>}
            <label className="wide">נושא<input name="subject" required maxLength={180} placeholder="לדוגמה: עדכון יומי / מסמך חסר" /></label>
            <label className="wide">הודעה<textarea name="body" rows={6} required maxLength={8000} placeholder="כתבו הודעה ברורה וקצרה..." /></label>
            <label className="wide communication-upload-field"><Paperclip size={19} /><span>קובץ פרטי (תמונה או PDF, עד 5MB)</span><input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></label>
          </div>
          <div className="communication-modal-actions"><button className="button secondary" type="button" onClick={() => setComposeOpen(false)}>ביטול</button><button className="button primary" disabled={isPending} type="submit"><Send size={18} /> {isPending ? "שולח..." : "שליחת הודעה"}</button></div>
        </form>
      </div> : null}
      {feedback ? <div className={`communication-toast ${feedback.includes("נשלח") ? "success" : "error"}`} role="status">{feedback}<button type="button" onClick={() => setFeedback("")} aria-label="סגירה"><X size={15} /></button></div> : null}
    </section>
  );
}
