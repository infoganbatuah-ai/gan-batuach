"use client";

import { useMemo, useRef, useState } from "react";
import { ClipboardCheck, FileSignature, ListChecks } from "lucide-react";
import {
  DashboardGrid,
  EmptyState,
  PremiumCard,
  SectionHeader,
  StatusChip
} from "@/components/gan-batuach-design-system";

type Inspection = { id: string; garden_id: string; form_id: string; status?: string | null; gardens?: { name?: string | null; city?: string | null } | null };
type Question = { id: string; form_id: string; category: string; question_text: string; question_type?: string | null; weight?: number | null; critical?: boolean | null; required?: boolean | null };

type AnswerState = Record<string, { score?: number; boolean_value?: boolean; text_value?: string; note?: string; photo_url?: string; document_url?: string }>;

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    open: "פתוח",
    planned: "מתוכננת",
    scheduled: "מתוכננת",
    in_progress: "בביצוע",
    pending: "ממתינה להשלמה",
    follow_up: "נדרש מעקב",
    overdue: "באיחור",
    done: "הושלמה",
    completed: "הושלמה",
    closed: "נסגרה"
  };
  return labels[String(value ?? "").toLowerCase()] ?? "פתוח";
}

function questionTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    score: "ציון",
    boolean: "כן/לא",
    text_note: "הערה",
    photo_upload: "צילום",
    document_upload: "מסמך",
    video_upload: "ראיה"
  };
  return labels[String(value ?? "").toLowerCase()] ?? "ציון";
}

export function InspectorInspectionWizard({ inspections, questions, initialInspectionId = "" }: { inspections: Inspection[]; questions: Question[]; initialInspectionId?: string }) {
  const [rows, setRows] = useState(inspections);
  const [selectedInspectionId, setSelectedInspectionId] = useState(initialInspectionId && inspections.some((inspection) => inspection.id === initialInspectionId) ? initialInspectionId : inspections[0]?.id || "");
  const [answers, setAnswers] = useState<AnswerState>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signature, setSignature] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inspection = rows.find((item) => item.id === selectedInspectionId);
  const formQuestions = useMemo(() => questions.filter((question) => question.form_id === inspection?.form_id), [questions, inspection?.form_id]);
  const categories = [...new Set(formQuestions.map((question) => question.category))];
  const answered = formQuestions.filter((question) => answers[question.id]?.score || answers[question.id]?.boolean_value !== undefined || answers[question.id]?.text_value).length;
  const weighted = formQuestions.reduce((acc, question) => {
    const score = answers[question.id]?.score;
    const weight = Number(question.weight || 1);
    return score ? { sum: acc.sum + score * weight, weight: acc.weight + weight } : acc;
  }, { sum: 0, weight: 0 });
  const score = weighted.weight ? (weighted.sum / weighted.weight).toFixed(2) : "-";
  const exceptions = formQuestions.filter((question) => Number(answers[question.id]?.score || 10) <= 4);

  function update(questionId: string, patch: AnswerState[string]) {
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], ...patch } }));
  }

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !isSigning) return;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#0b2f73";
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
    setSignature(canvas.toDataURL("image/png"));
  }

  function startSign(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    setIsSigning(true);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  }

  async function submit() {
    setError(null); setMessage(null);
    if (!inspection) return;
    const missingRequired = formQuestions.filter((question) => question.required && !answers[question.id]?.score && answers[question.id]?.boolean_value === undefined && !answers[question.id]?.text_value);
    if (missingRequired.length) { setError(`חסרות ${missingRequired.length} שאלות חובה לפני שליחה.`); return; }
    if (!signature) { setError("חובה לחתום על המסך לפני סיום ביקורת."); return; }
    if (!navigator.geolocation) { setError("הדפדפן לא תומך ב-GPS. יש להשתמש במכשיר עם הרשאת מיקום."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const payload = {
          gps_lat: position.coords.latitude,
          gps_lng: position.coords.longitude,
          gps_radius_meters: 120,
          signature_image: signature,
          answers: formQuestions.map((question) => ({ question_id: question.id, score: answers[question.id]?.score || (answers[question.id]?.boolean_value === false ? 4 : 10), boolean_value: answers[question.id]?.boolean_value, text_value: answers[question.id]?.text_value, note: answers[question.id]?.note, photo_url: answers[question.id]?.photo_url, document_url: answers[question.id]?.document_url }))
        };
        const response = await fetch("/api/inspections/" + inspection.id + "/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "שליחת ביקורת נכשלה");
        setRows((current) => current.filter((item) => item.id !== inspection.id));
        setSelectedInspectionId(rows.find((item) => item.id !== inspection.id)?.id ?? "");
        setAnswers({});
        clearSignature();
        setMessage("הביקורת נשלחה. המערכת תחשב ציון, ליקויים ומשימות תיקון.");
      } catch (err) { setError(err instanceof Error ? err.message : "שליחת ביקורת נכשלה"); }
      finally { setBusy(false); }
    }, () => { setBusy(false); setError("לא ניתנה הרשאת מיקום. יש לאפשר GPS כדי לשלוח ביקורת."); });
  }

  return (
    <div className="inspection-wizard-shell">
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}
      <DashboardGrid columns={2} className="inspector-form-grid">
        <PremiumCard className="inspector-section-card">
          <SectionHeader title="בחירת ביקורת" subtitle="בחרו גן ומשימת ביקורת פתוחה" icon={ClipboardCheck} />
          {rows.length === 0 ? (
            <EmptyState title="אין ביקורות פתוחות" text="משימות חודשיות יופיעו כאן לאחר יצירה." icon={ClipboardCheck} />
          ) : (
            <div className="inspector-list">
              {rows.map((item) => (
                <button className={item.id === selectedInspectionId ? "gb-list-row-card selected" : "gb-list-row-card"} key={item.id} onClick={() => setSelectedInspectionId(item.id)}>
                  <div className="gb-list-main">
                    <b>{item.gardens?.name || "גן"}</b>
                    <span>{item.gardens?.city || ""} · {statusLabel(item.status)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </PremiumCard>
        <PremiumCard className="inspector-section-card">
          <SectionHeader title="התקדמות וציון" subtitle="מעקב מילוי לפני שליחה" icon={ListChecks} />
          <div className="inspector-progress-line">
            <div><b>{answered}/{formQuestions.length} שאלות</b><small>{score} ציון</small></div>
            <span><i style={{ width: formQuestions.length ? `${Math.round((answered / formQuestions.length) * 100)}%` : "0%" }} /></span>
          </div>
          <DashboardGrid columns={3}>
            <StatusChip tone="primary">{answered} נענו</StatusChip>
            <StatusChip tone={exceptions.length ? "danger" : "success"}>{exceptions.length} חריגים</StatusChip>
            <StatusChip tone="muted">{categories.length} קטגוריות</StatusChip>
          </DashboardGrid>
        </PremiumCard>
      </DashboardGrid>
      {categories.map((category) => (
        <PremiumCard className="inspector-section-card inspector-form-stack" key={category}>
          <SectionHeader title={category} subtitle="מלאו ציון, הערות והוכחות לפי סוג השאלה" icon={ListChecks} />
          {formQuestions.filter((question) => question.category === category).map((question) => (
            <div className="inspection-answer-card" key={question.id}>
              <div>
                <StatusChip tone={question.critical ? "danger" : "muted"}>{question.critical ? "קריטי" : questionTypeLabel(question.question_type)}</StatusChip>
                <strong>{question.question_text}</strong>
              </div>
              {question.question_type === "boolean" ? <select onChange={(event) => update(question.id, { boolean_value: event.target.value === "yes", score: event.target.value === "yes" ? 10 : 4 })}><option value="">בחרו</option><option value="yes">כן</option><option value="no">לא</option></select> : question.question_type === "text_note" ? <textarea placeholder="תשובה / הערה" onChange={(event) => update(question.id, { text_value: event.target.value, score: 10 })} /> : <input type="number" min="1" max="10" placeholder="ציון 1-10" onChange={(event) => update(question.id, { score: Number(event.target.value) })} />}
              <textarea placeholder="הערת פקח" onChange={(event) => update(question.id, { note: event.target.value })} />
              {question.question_type === "photo_upload" ? <input placeholder="קישור צילום / נתיב אחסון" onChange={(event) => update(question.id, { photo_url: event.target.value })} /> : null}
              {question.question_type === "document_upload" || question.question_type === "video_upload" ? <input placeholder={question.question_type === "video_upload" ? "קישור וידאו / ראיה" : "קישור מסמך / נתיב אחסון"} onChange={(event) => update(question.id, { document_url: event.target.value })} /> : null}
            </div>
          ))}
        </PremiumCard>
      ))}
      {inspection ? (
        <PremiumCard className="inspector-section-card">
          <SectionHeader title="חתימה וסיום" subtitle={`ציון משוקלל: ${score}. חריגים: ${exceptions.length}. החתימה, זמן השליחה ו-GPS יישמרו בדוח.`} icon={FileSignature} />
          <canvas ref={canvasRef} width={620} height={180} className="signature-pad" onPointerDown={startSign} onPointerMove={point} onPointerUp={() => setIsSigning(false)} onPointerLeave={() => setIsSigning(false)} />
          <div className="inspector-hero-actions">
            <button className="inspector-action-button" type="button" disabled={busy} onClick={clearSignature}>ניקוי חתימה</button>
            <button className="inspector-action-button" type="button" disabled={busy} onClick={submit}>{busy ? "שולח..." : "סיים ושלח ביקורת"}</button>
          </div>
        </PremiumCard>
      ) : null}
    </div>
  );
}
