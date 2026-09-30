"use client";

import { useMemo, useState, useTransition } from "react";
import { BellRing, CheckCircle2, ChevronLeft, Eye, Mail, Megaphone, MessageSquareText, Send, Smartphone, UsersRound, XCircle } from "lucide-react";
import type { DeliveryCapability } from "@/components/parent-notification-preferences";

export type BroadcastClassroom = { id: string; name?: string | null };
export type BroadcastHistoryItem = {
  id: string; subject?: string | null; thread_type?: string | null; classroom_id?: string | null;
  status?: string | null; created_at?: string | null; last_message_at?: string | null;
  metadata?: { audience_type?: string; audience_snapshot?: string[] } | null;
  communication_thread_participants?: Array<{ profile_id?: string | null }>;
};

const defaultCapability: DeliveryCapability = { in_app: "available", push: "not_configured", email: "not_configured", whatsapp: "not_configured", sms: "not_configured" };
const isReady = (value: string) => value === "available" || value === "provider_submission_available";

export function BroadcastCenter({ gardenId, classrooms, broadcasts, capability = defaultCapability }: {
  gardenId: string; classrooms: BroadcastClassroom[]; broadcasts: BroadcastHistoryItem[]; capability?: DeliveryCapability;
}) {
  const [audience, setAudience] = useState<"parents" | "staff">("parents");
  const [classroomId, setClassroomId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState(broadcasts);
  const [pending, startTransition] = useTransition();
  const audienceLabel = audience === "parents" ? (classroomId ? "הורי הכיתה שנבחרה" : "כל הורי הגן") : "כל אנשי הצוות הפעילים";
  const externalReady = useMemo(() => (["push", "email", "whatsapp", "sms"] as const).filter((channel) => isReady(capability[channel])), [capability]);

  function submit() {
    if (!subject.trim() || !body.trim()) return;
    setFeedback("");
    startTransition(async () => {
      const response = await fetch("/api/communication/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ garden_id: gardenId, classroom_id: classroomId || undefined, audience, subject: subject.trim(), body: body.trim() })
      });
      const result = await response.json();
      if (!response.ok) { setFeedback(result.error || "שליחת הודעת הגן נכשלה."); return; }
      setHistory((current) => [{
        id: result.data.thread_id, subject: subject.trim(), thread_type: audience === "staff" ? "staff_broadcast" : classroomId ? "classroom_broadcast" : "garden_broadcast",
        classroom_id: classroomId || null, status: "open", created_at: new Date().toISOString(), last_message_at: new Date().toISOString(),
        metadata: { audience_type: audience }, communication_thread_participants: Array.from({ length: Number(result.data.audience_count || 0) }, () => ({}))
      }, ...current]);
      setFeedback(`הודעת הגן נשלחה בתוך המערכת ל־${result.data.audience_count} נמענים מורשים.`);
      setSubject(""); setBody(""); setClassroomId(""); setPreview(false);
    });
  }

  return (
    <section className="broadcast-platform" dir="rtl">
      <div className="broadcast-hero">
        <div><span className="eyebrow">שידור תפעולי</span><h2><Megaphone size={25} /> הודעת גן חדשה</h2><p>הודעה אחת לקהל קנוני. השיחות האישיות, המשימות והתלונות נשארות נפרדות.</p></div>
        <span className="broadcast-truth-badge"><BellRing size={17} /> מסירה בתוך האפליקציה</span>
      </div>
      <div className="broadcast-layout">
        <div className="broadcast-compose-card">
          <div className="broadcast-step"><b>1</b><div><strong>בחירת קהל</strong><small>הקהל נבדק ונקבע בשרת בזמן השליחה</small></div></div>
          <div className="broadcast-audience-grid">
            <button className={audience === "parents" ? "active" : ""} type="button" onClick={() => setAudience("parents")}><UsersRound /><strong>הורים</strong><span>כל ההורים או כיתה</span></button>
            <button className={audience === "staff" ? "active" : ""} type="button" onClick={() => { setAudience("staff"); setClassroomId(""); }}><UsersRound /><strong>צוות</strong><span>עובדים פעילים בלבד</span></button>
          </div>
          {audience === "parents" ? <label className="broadcast-field">כיתה (רשות)<select value={classroomId} onChange={(event) => setClassroomId(event.target.value)}><option value="">כל הורי הגן</option>{classrooms.map((item) => <option value={item.id} key={item.id}>{item.name ?? "כיתה"}</option>)}</select></label> : null}
          <div className="broadcast-step"><b>2</b><div><strong>כתיבת ההודעה</strong><small>כותרת קצרה ותוכן בטוח לתצוגה בתוך האפליקציה</small></div></div>
          <label className="broadcast-field">נושא<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={180} placeholder="לדוגמה: תזכורת לטיול ביום חמישי" /></label>
          <label className="broadcast-field">תוכן<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={8000} rows={6} placeholder="כתבו את ההודעה..." /></label>
          <div className="broadcast-channel-summary"><strong>ערוצי מסירה</strong><span className="ready"><CheckCircle2 /> בתוך האפליקציה</span>{externalReady.map((channel) => <span className="ready" key={channel}><CheckCircle2 />{channel}</span>)}{(["push", "email", "whatsapp", "sms"] as const).filter((channel) => !isReady(capability[channel])).map((channel) => <span className="unavailable" key={channel}><XCircle />{channel} לא זמין</span>)}</div>
          <div className="broadcast-actions"><button className="button secondary" type="button" onClick={() => setPreview(true)} disabled={!subject.trim() || !body.trim()}><Eye size={18} /> תצוגה מקדימה</button><button className="button primary" type="button" onClick={() => setPreview(true)} disabled={!subject.trim() || !body.trim()}><ChevronLeft size={18} /> המשך לאישור</button></div>
          {feedback ? <p className={feedback.includes("נשלחה") ? "communication-save-message success" : "communication-save-message error"}>{feedback}</p> : null}
        </div>
        <aside className="broadcast-history-card">
          <div className="broadcast-history-head"><div><span className="eyebrow">היסטוריה</span><h3>הודעות גן אחרונות</h3></div><span>{history.length}</span></div>
          <div className="broadcast-history-list">
            {history.length ? history.map((item) => {
              const count = Math.max(0, (item.communication_thread_participants?.length ?? 1) - 1);
              const audienceText = item.metadata?.audience_type === "staff" || item.thread_type === "staff_broadcast" ? "צוות" : item.thread_type === "classroom_broadcast" ? "הורי כיתה" : "כל ההורים";
              return <article key={item.id}><span className="broadcast-history-icon"><Megaphone size={19} /></span><div><strong>{item.subject || "הודעת גן"}</strong><p>{audienceText} · {count || "קהל קנוני"} נמענים</p><small>{item.created_at ? new Date(item.created_at).toLocaleString("he-IL") : "נשלח לאחרונה"}</small></div><span className="pill good">נשלח במערכת</span></article>;
            }) : <div className="communication-empty"><Megaphone size={34} /><strong>אין שידורים עדיין</strong><span>הודעת הגן הראשונה תופיע כאן לאחר השליחה.</span></div>}
          </div>
        </aside>
      </div>
      {preview ? <div className="communication-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(false); }}>
        <div className="broadcast-preview-modal" role="dialog" aria-modal="true" aria-labelledby="broadcast-preview-title">
          <span className="broadcast-preview-icon"><Megaphone size={30} /></span><span className="eyebrow">בדיקה לפני שליחה</span><h2 id="broadcast-preview-title">{subject}</h2><p>{body}</p>
          <dl><div><dt>קהל</dt><dd>{audienceLabel}</dd></div><div><dt>קובץ</dt><dd>ללא קובץ — ה־API הקנוני אינו תומך כרגע בצירוף לשידור</dd></div><div><dt>מסירה מאומתת</dt><dd>בתוך האפליקציה בלבד{externalReady.length ? ` + ${externalReady.join(", ")}` : ""}</dd></div></dl>
          <div className="broadcast-preview-actions"><button className="button secondary" type="button" onClick={() => setPreview(false)}>חזרה לעריכה</button><button className="button primary" type="button" disabled={pending} onClick={submit}><Send size={18} />{pending ? "שולח..." : "שליחת הודעת גן"}</button></div>
        </div>
      </div> : null}
    </section>
  );
}

export function DeliveryReadinessStrip({ capability = defaultCapability }: { capability?: DeliveryCapability }) {
  const items = [
    { key: "in_app", label: "באפליקציה", icon: BellRing },
    { key: "push", label: "Push", icon: Smartphone },
    { key: "email", label: "Email", icon: Mail },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquareText },
    { key: "sms", label: "SMS", icon: Send }
  ] as const;
  return <div className="delivery-readiness-strip">{items.map((item) => { const Icon = item.icon; const active = isReady(capability[item.key]); return <article className={active ? "ready" : "unavailable"} key={item.key}><Icon size={20} /><div><strong>{item.label}</strong><span>{active ? item.key === "in_app" ? "פעיל" : "ספק מוכן" : "לא מחובר"}</span></div>{active ? <CheckCircle2 size={17} /> : <XCircle size={17} />}</article>; })}</div>;
}
