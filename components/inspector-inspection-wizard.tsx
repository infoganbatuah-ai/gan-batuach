"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, Check, ChevronLeft, ChevronRight, ClipboardCheck, Cloud, FileCheck2, FileSignature, FileText, Image as ImageIcon, ListChecks, LoaderCircle, MapPin, Save, ShieldCheck, X } from "lucide-react";
import { EmptyState, StatusChip } from "@/components/gan-batuach-design-system";

type Inspection = { id: string; garden_id: string; form_id: string; status?: string | null; started_at?: string | null; due_at?: string | null; gardens?: { name?: string | null; city?: string | null; address?: string | null } | null };
type Question = { id: string; form_id: string; category: string; question_text: string; question_type?: string | null; weight?: number | null; critical?: boolean | null; required?: boolean | null; requires_photo?: boolean | null; requires_document?: boolean | null };
type Answer = { score?: number; boolean_value?: boolean; text_value?: string; note?: string; photo_url?: string; document_url?: string };
type AnswerState = Record<string, Answer>;
type SaveState = "idle" | "loading" | "dirty" | "saving" | "saved" | "error";
type SubmissionResult = { inspection_id?: string; weighted_score?: number; violations?: number; critical_failures?: number };

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = { open: "פתוחה", planned: "מתוכננת", scheduled: "מתוכננת", in_progress: "בביצוע", pending: "ממתינה להשלמה", overdue: "באיחור" };
  return labels[String(value ?? "").toLowerCase()] ?? "פתוחה";
}

function questionTypeLabel(value?: string | null) {
  const labels: Record<string, string> = { score: "דירוג 1–10", score_1_10: "דירוג 1–10", boolean: "כן / לא", text_note: "תשובה מילולית", photo_upload: "צילום", document_upload: "מסמך", video_upload: "ראיה" };
  return labels[String(value ?? "").toLowerCase()] ?? "דירוג 1–10";
}

function hasCoreAnswer(question: Question, answer?: Answer) {
  if (!answer) return false;
  if (question.question_type === "boolean") return answer.boolean_value !== undefined;
  if (question.question_type === "text_note") return Boolean(answer.text_value?.trim());
  if (question.question_type === "photo_upload") return Boolean(answer.photo_url);
  if (question.question_type === "document_upload") return Boolean(answer.document_url);
  return Number.isFinite(answer.score);
}

function isComplete(question: Question, answer?: Answer) {
  if (!hasCoreAnswer(question, answer)) return false;
  if (question.requires_photo && !answer?.photo_url) return false;
  if (question.requires_document && !answer?.document_url) return false;
  return true;
}

function saveLabel(state: SaveState, lastSavedAt: Date | null) {
  if (state === "loading") return "טוען טיוטה…";
  if (state === "saving") return "שומר בשרת…";
  if (state === "dirty") return "יש שינויים שלא נשמרו";
  if (state === "error") return "השמירה נכשלה";
  if (state === "saved") return lastSavedAt ? `נשמר ${lastSavedAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : "הטיוטה שמורה";
  return "מוכן למילוי";
}

export function InspectorInspectionWizard({ inspections, questions, initialInspectionId = "" }: { inspections: Inspection[]; questions: Question[]; initialInspectionId?: string }) {
  const selectedInspectionId = initialInspectionId && inspections.some((item) => item.id === initialInspectionId) ? initialInspectionId : inspections[0]?.id || "";
  const [answers, setAnswers] = useState<AnswerState>({});
  const [activeCategory, setActiveCategory] = useState("");
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(selectedInspectionId ? "loading" : "idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signature, setSignature] = useState("");
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inspection = inspections.find((item) => item.id === selectedInspectionId);
  const formQuestions = useMemo(() => questions.filter((question) => question.form_id === inspection?.form_id), [questions, inspection?.form_id]);
  const categories = useMemo(() => [...new Set(formQuestions.map((question) => question.category))], [formQuestions]);
  const category = activeCategory && categories.includes(activeCategory) ? activeCategory : categories[0] ?? "";
  const categoryQuestions = formQuestions.filter((question) => question.category === category);
  const completed = formQuestions.filter((question) => isComplete(question, answers[question.id])).length;
  const missingRequired = formQuestions.filter((question) => question.required && !isComplete(question, answers[question.id]));
  const evidenceCount = formQuestions.reduce((total, question) => total + (answers[question.id]?.photo_url ? 1 : 0) + (answers[question.id]?.document_url ? 1 : 0), 0);
  const progress = formQuestions.length ? Math.round((completed / formQuestions.length) * 100) : 0;
  const currentQuestion = categoryQuestions[Math.min(activeQuestion, Math.max(categoryQuestions.length - 1, 0))];

  useEffect(() => {
    if (!selectedInspectionId) return;
    let active = true;
    fetch(`/api/inspections/${selectedInspectionId}/draft`).then((response) => response.json()).then((body) => {
      if (!active) return;
      const draftAnswers = Array.isArray(body.data?.answers) ? body.data.answers : [];
      setAnswers(Object.fromEntries(draftAnswers.map((answer: { question_id: string }) => [answer.question_id, answer])));
      setLastSavedAt(body.data?.updated_at ? new Date(body.data.updated_at) : null);
      setSaveState(draftAnswers.length ? "saved" : "idle");
    }).catch(() => { if (active) { setError("לא ניתן לטעון את הטיוטה השמורה."); setSaveState("error"); } });
    return () => { active = false; };
  }, [selectedInspectionId]);

  async function saveDraft() {
    if (!inspection) return false;
    setBusy(true); setError(null); setMessage(null); setSaveState("saving");
    try {
      const response = await fetch(`/api/inspections/${inspection.id}/draft`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, ...answer })) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "שמירת הטיוטה נכשלה");
      setLastSavedAt(body.data?.updated_at ? new Date(body.data.updated_at) : new Date()); setSaveState("saved"); setMessage("הטיוטה נשמרה בשרת. אפשר לחזור ולהמשיך מאותו מקום.");
      return true;
    } catch (err) { setSaveState("error"); setError(err instanceof Error ? err.message : "שמירת הטיוטה נכשלה"); return false; }
    finally { setBusy(false); }
  }

  function update(questionId: string, patch: Answer) {
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], ...patch } }));
    setSaveState("dirty"); setMessage(null); setError(null);
  }

  async function uploadEvidence(questionId: string, file: File, kind: "photo_url" | "document_url") {
    if (!inspection) return;
    setUploadingQuestionId(questionId); setError(null);
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`/api/inspections/${inspection.id}/evidence`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "שמירת הראיה נכשלה");
      update(questionId, { [kind]: body.data.path });
      setMessage("הראיה נשמרה באחסון פרטי. יש לשמור את הטיוטה כדי לקשר אותה לסעיף.");
    } catch (err) { setError(err instanceof Error ? err.message : "שמירת הראיה נכשלה"); }
    finally { setUploadingQuestionId(null); }
  }

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !isSigning) return;
    const rect = canvas.getBoundingClientRect(); const context = canvas.getContext("2d");
    if (!context) return;
    context.lineWidth = 3; context.lineCap = "round"; context.strokeStyle = "#0b2f73"; context.lineTo(event.clientX - rect.left, event.clientY - rect.top); context.stroke();
    setSignature(canvas.toDataURL("image/png"));
  }

  function startSign(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current; const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect(); context.beginPath(); context.moveTo(event.clientX - rect.left, event.clientY - rect.top); setIsSigning(true);
  }

  function clearSignature() {
    const canvas = canvasRef.current; const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  }

  async function openReview() {
    if (saveState === "dirty" && !(await saveDraft())) return;
    setReviewOpen(true);
  }

  async function submit() {
    setError(null); setMessage(null);
    if (!inspection) return;
    if (missingRequired.length) { setError(`חסרים ${missingRequired.length} סעיפי חובה לפני הגשה.`); return; }
    if (!signature) { setError("חובה לחתום לפני הגשת הביקורת."); return; }
    if (!navigator.geolocation) { setError("המכשיר אינו תומך באימות מיקום הנדרש להגשה."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const payload = { gps_lat: position.coords.latitude, gps_lng: position.coords.longitude, gps_radius_meters: 120, signature_image: signature, answers: Object.entries(answers).filter(([questionId]) => formQuestions.some((question) => question.id === questionId)).map(([question_id, answer]) => ({ question_id, ...answer })) };
        const response = await fetch(`/api/inspections/${inspection.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "שליחת הביקורת נכשלה");
        setSubmissionResult(body.data ?? {}); setReviewOpen(false);
        setAnswers({}); clearSignature(); setSaveState("idle"); setMessage("הביקורת הוגשה. הציון והממצאים חושבו וננעלו בשרת.");
      } catch (err) { setError(err instanceof Error ? err.message : "שליחת הביקורת נכשלה"); }
      finally { setBusy(false); }
    }, () => { setBusy(false); setError("לא ניתנה הרשאת מיקום. יש לאפשר GPS כדי להגיש את הביקורת."); });
  }

  if (submissionResult) {
    return <section className="inspection-submitted-state" aria-live="polite"><span><Check /></span><p>הביקורת הוגשה וננעלה</p><h2>ציון שרת: {submissionResult.weighted_score ?? "נשמר בדוח"}</h2><div><StatusChip tone="warning">{submissionResult.violations ?? 0} ממצאים</StatusChip><StatusChip tone="danger">{submissionResult.critical_failures ?? 0} קריטיים</StatusChip></div><a className="inspection-primary-action" href={`/dashboard/inspector/inspections/${submissionResult.inspection_id ?? selectedInspectionId}/report`}>פתיחת הדוח הסופי</a></section>;
  }
  if (!inspection) return <EmptyState title="אין ביקורות פתוחות" text="משימות חודשיות יופיעו כאן לאחר שיוך קנוני." icon={ClipboardCheck} />;

  return <section className="inspection-experience" aria-label="סביבת עבודה לביקורת">
    {error ? <div className="inspection-banner error" role="alert"><AlertCircle />{error}</div> : null}
    {message ? <div className="inspection-banner success" role="status"><Check />{message}</div> : null}
    <header className="inspection-workspace-head"><div className="inspection-garden-identity"><span><ShieldCheck /></span><div><small>ביקורת חודשית</small><h2>{inspection.gardens?.name ?? "גן"}</h2><p><MapPin /> {inspection.gardens?.city ?? ""}{inspection.gardens?.address ? ` · ${inspection.gardens.address}` : ""}</p></div></div><div className="inspection-head-status"><StatusChip tone="primary">{statusLabel(inspection.status)}</StatusChip><span className={`inspection-save-state ${saveState}`}><Cloud />{saveLabel(saveState, lastSavedAt)}</span></div></header>
    <div className="inspection-progress-card"><div><span>התקדמות ביקורת</span><strong>{progress}%</strong></div><span className="inspection-progress-track" role="progressbar" aria-label="התקדמות ביקורת" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></span><div className="inspection-progress-facts"><span><Check /> {completed} מתוך {formQuestions.length} הושלמו</span><span><FileCheck2 /> {evidenceCount} ראיות פרטיות</span><span><AlertCircle /> {missingRequired.length} סעיפי חובה חסרים</span></div></div>
    <div className="inspection-workspace-grid"><nav className="inspection-category-nav" aria-label="קטגוריות צ׳ק ליסט"><h3><ListChecks /> סעיפי הביקורת</h3>{categories.map((item) => { const items = formQuestions.filter((question) => question.category === item); const done = items.filter((question) => isComplete(question, answers[question.id])).length; return <button key={item} type="button" className={item === category ? "active" : ""} onClick={() => { setActiveCategory(item); setActiveQuestion(0); }}><span>{item}<small>{done}/{items.length} הושלמו</small></span>{done === items.length && items.length ? <Check /> : <ChevronLeft />}</button>; })}<div className="inspection-score-truth"><ShieldCheck /><span><strong>הציון מחושב בשרת</strong><small>הציון הסופי יוצג רק לאחר הגשה ונעילה.</small></span></div></nav>
      <div className="inspection-checklist-panel"><div className="inspection-section-heading"><div><small>קטגוריה {categories.indexOf(category) + 1} מתוך {categories.length}</small><h3>{category || "צ׳ק ליסט"}</h3></div><StatusChip tone="muted">{categoryQuestions.length} סעיפים</StatusChip></div><div className="inspection-mobile-step" aria-live="polite"><span>סעיף {Math.min(activeQuestion + 1, categoryQuestions.length)} מתוך {categoryQuestions.length}</span><div><button type="button" aria-label="הסעיף הקודם" disabled={activeQuestion === 0} onClick={() => setActiveQuestion((value) => Math.max(0, value - 1))}><ChevronRight /></button><button type="button" aria-label="הסעיף הבא" disabled={activeQuestion >= categoryQuestions.length - 1} onClick={() => setActiveQuestion((value) => Math.min(categoryQuestions.length - 1, value + 1))}><ChevronLeft /></button></div></div>
        <div className="inspection-question-list">{categoryQuestions.map((question, index) => { const answer = answers[question.id]; const complete = isComplete(question, answer); const uploading = uploadingQuestionId === question.id; return <fieldset className={`inspection-question-card ${complete ? "complete" : ""} ${currentQuestion?.id === question.id ? "mobile-current" : ""}`} key={question.id}><legend className="sr-only">{question.question_text}</legend><div className="inspection-question-title"><span>{complete ? <Check /> : index + 1}</span><div><div>{question.required ? <StatusChip tone="warning">חובה</StatusChip> : <StatusChip tone="muted">רשות</StatusChip>}{question.critical ? <StatusChip tone="danger">קריטי</StatusChip> : null}<small>{questionTypeLabel(question.question_type)}</small></div><h4>{question.question_text}</h4></div></div>
          <div className="inspection-answer-control">{question.question_type === "boolean" ? <div className="inspection-segmented"><button className={answer?.boolean_value === true ? "selected" : ""} type="button" onClick={() => update(question.id, { boolean_value: true, score: 10 })}><Check /> כן</button><button className={answer?.boolean_value === false ? "selected danger" : ""} type="button" onClick={() => update(question.id, { boolean_value: false, score: 1 })}><X /> לא</button></div> : question.question_type === "text_note" ? <label><span>תשובה</span><textarea value={answer?.text_value ?? ""} placeholder="כתבו תשובה מקצועית ומדויקת" onChange={(event) => update(question.id, { text_value: event.target.value, score: 10 })} /></label> : question.question_type === "photo_upload" || question.question_type === "document_upload" ? null : <label><span>תוצאת הסעיף</span><div className="inspection-score-input"><input aria-label={`תוצאה עבור ${question.question_text}`} type="number" min="1" max="10" inputMode="numeric" value={answer?.score ?? ""} placeholder="—" onChange={(event) => update(question.id, { score: event.target.value ? Number(event.target.value) : undefined })} /><em>מתוך 10</em></div></label>}<label><span>הערת מפקח</span><textarea value={answer?.note ?? ""} placeholder="תצפית, הקשר או פעולה מומלצת" onChange={(event) => update(question.id, { note: event.target.value })} /></label></div>
          {(question.question_type === "photo_upload" || question.requires_photo || question.question_type === "document_upload" || question.requires_document) ? <div className="inspection-evidence-zone"><div><Camera /><span><strong>ראיה פרטית לסעיף</strong><small>JPG, PNG, WEBP או PDF · עד 12MB · גישה חתומה בלבד</small></span></div><div className="inspection-upload-actions">{question.question_type === "photo_upload" || question.requires_photo ? <label className={answer?.photo_url ? "uploaded" : ""}>{uploading ? <LoaderCircle className="spin" /> : answer?.photo_url ? <Check /> : <ImageIcon />}<span>{answer?.photo_url ? "צילום נשמר" : "הוספת צילום"}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadEvidence(question.id, file, "photo_url"); }} /></label> : null}{question.question_type === "document_upload" || question.requires_document ? <label className={answer?.document_url ? "uploaded" : ""}>{uploading ? <LoaderCircle className="spin" /> : answer?.document_url ? <Check /> : <FileText />}<span>{answer?.document_url ? "מסמך נשמר" : "הוספת מסמך"}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadEvidence(question.id, file, "document_url"); }} /></label> : null}</div></div> : null}
        </fieldset>; })}</div>
      </div></div>
    <div className="inspection-sticky-actions"><span className={`inspection-save-state ${saveState}`}><Cloud />{saveLabel(saveState, lastSavedAt)}</span><div><button className="inspection-secondary-action" type="button" disabled={busy} onClick={() => void saveDraft()}><Save /> שמירת טיוטה</button><button className="inspection-primary-action" type="button" disabled={busy || !formQuestions.length} onClick={() => void openReview()}>סקירה לפני הגשה <ChevronLeft /></button></div></div>
    {reviewOpen ? <div className="inspection-review-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setReviewOpen(false); }}><section className="inspection-review-dialog" role="dialog" aria-modal="true" aria-labelledby="inspection-review-title"><header><div><small>שלב אחרון</small><h2 id="inspection-review-title">סקירה והגשת ביקורת</h2><p>בדקו את השלמות, חתמו ואשרו מיקום. הציון והממצאים יחושבו בשרת בלבד.</p></div><button type="button" aria-label="סגירת הסקירה" onClick={() => setReviewOpen(false)}><X /></button></header><div className="inspection-review-summary"><div><Check /><span><strong>{completed}/{formQuestions.length}</strong><small>סעיפים הושלמו</small></span></div><div><FileCheck2 /><span><strong>{evidenceCount}</strong><small>ראיות פרטיות</small></span></div><div className={missingRequired.length ? "warning" : "success"}><AlertCircle /><span><strong>{missingRequired.length}</strong><small>חובות חסרות</small></span></div></div>
      {missingRequired.length ? <div className="inspection-missing-list"><strong>נדרש להשלים לפני הגשה</strong>{missingRequired.slice(0, 5).map((question) => <button type="button" key={question.id} onClick={() => { setActiveCategory(question.category); setActiveQuestion(formQuestions.filter((item) => item.category === question.category).findIndex((item) => item.id === question.id)); setReviewOpen(false); }}>{question.question_text}<ChevronLeft /></button>)}</div> : <div className="inspection-ready-note"><ShieldCheck /><span><strong>הביקורת מוכנה לחתימה</strong><small>לאחר ההגשה התשובות והציון ההיסטורי יינעלו.</small></span></div>}
      <div className="inspection-signature-block"><div><FileSignature /><span><strong>חתימת מפקח</strong><small>החתימה, זמן ההגשה ואימות המיקום נשמרים בדוח.</small></span><button type="button" onClick={clearSignature}>ניקוי</button></div><canvas ref={canvasRef} width={760} height={180} className="inspection-signature-pad" aria-label="משטח חתימה" onPointerDown={startSign} onPointerMove={point} onPointerUp={() => setIsSigning(false)} onPointerLeave={() => setIsSigning(false)} /></div><div className="inspection-location-truth"><MapPin /><span><strong>אימות מיקום בזמן הגשה</strong><small>הדפדפן יבקש הרשאת GPS. אין השלמה מדומה כאשר המיקום חסר.</small></span></div><footer><button className="inspection-secondary-action" type="button" onClick={() => setReviewOpen(false)}>חזרה לעריכה</button><button className="inspection-primary-action" type="button" disabled={busy || missingRequired.length > 0 || !signature} onClick={() => void submit()}>{busy ? <><LoaderCircle className="spin" /> מגיש…</> : <><FileSignature /> הגשה ונעילת דוח</>}</button></footer></section></div> : null}
  </section>;
}
