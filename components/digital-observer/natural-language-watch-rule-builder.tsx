"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, Check, Clock3, LoaderCircle, Pencil, Power, PowerOff, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

type CameraOption = { id: string; display_name?: string | null; location_label?: string | null };
type RuleRow = {
  id: string;
  title?: string | null;
  original_natural_language?: string | null;
  rule_state?: string | null;
  rule_version?: number | null;
  compiler_version?: string | null;
  last_matched_at?: string | null;
  match_count?: number | null;
};
type Compilation = {
  status: string;
  originalText: string;
  candidateFingerprint: string | null;
  preview: { camera: string; event: string; time: string; days: string; duration: string; action: string; warning: string } | null;
  clarification: { question: string; options: Array<{ id: string; label: string }> } | null;
  unsupported: { capability: string; explanation: string } | null;
  validation: { valid: boolean; errors: string[] };
};
type Simulation = { days: number; evaluatedRealEventCount: number; matchCount: number; liveExecution: false; syntheticEventsUsed: false };

async function postJson(body: unknown, isCurrent: () => boolean = () => true) {
  if (!isCurrent()) return null;
  const accessToken = readObserverAccessToken();
  const response = await fetch("/api/digital-observer/watch-rules", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!isCurrent()) return null;
  const payload = await response.json().catch(() => ({}));
  if (!isCurrent()) return null;
  if (!response.ok) throw new Error(payload.error || "לא ניתן לעבד את הכלל");
  return payload.data;
}

const stateLabel = (state?: string | null) => {
  const labels: Record<string, string> = { ACTIVE: "פעיל", DISABLED: "מושבת", ARCHIVED: "בארכיון" };
  return labels[String(state)] ?? "ישן / לא מהודר";
};

export function NaturalLanguageWatchRuleBuilder({
  siteId,
  cameras,
  rules
}: {
  siteId: string;
  cameras: CameraOption[];
  rules: RuleRow[];
}) {
  return <ScopedNaturalLanguageWatchRuleBuilder key={siteId} siteId={siteId} cameras={cameras} rules={rules} />;
}

function ScopedNaturalLanguageWatchRuleBuilder({ siteId, cameras, rules }: Parameters<typeof NaturalLanguageWatchRuleBuilder>[0]) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [cameraSourceId, setCameraSourceId] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [compilation, setCompilation] = useState<Compilation | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [renderedRevision, setRenderedRevision] = useState(0);
  const owner = useRef({ active: true, revision: 0, operation: 0, busy: false, preview: null as { revision: number; compilation: Compilation } | null });
  useLayoutEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    return () => { lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; };
  }, []);
  const ownsDraft = () => owner.current.active && owner.current.revision === renderedRevision;
  function beginRequest() {
    if (!ownsDraft() || owner.current.busy) return null;
    const lifetime = owner.current;
    const operation = ++lifetime.operation;
    const revision = lifetime.revision;
    lifetime.busy = true;
    setBusy(true);
    return { isCurrent: () => lifetime.active && lifetime.operation === operation && lifetime.revision === revision };
  }
  function changeDraft() {
    if (!ownsDraft()) return null;
    const lifetime = owner.current;
    const revision = ++lifetime.revision;
    const operation = ++lifetime.operation;
    lifetime.busy = false;
    lifetime.preview = null;
    setRenderedRevision(revision);
    setBusy(false);
    setCompilation(null);
    setSimulation(null);
    return { isCurrent: () => lifetime.active && lifetime.revision === revision && lifetime.operation === operation };
  }
  function changeText(next: string) { if (changeDraft()) setText(next); }
  function changeCamera(next: string) { if (changeDraft()) setCameraSourceId(next); }

  async function compile(event?: FormEvent<HTMLFormElement>) {
    if (!ownsDraft()) return;
    event?.preventDefault();
    if (text.trim().length < 3) return;
    const request = beginRequest();
    if (!request) return;
    const submitted = { siteId, text, cameraSourceId, editingRuleId };
    setError("");
    setMessage("");
    try {
      const data = await postJson({
        action: "compile",
        observer_site_id: submitted.siteId,
        text: submitted.text,
        camera_source_id: submitted.cameraSourceId || null,
        editing_rule_id: submitted.editingRuleId
      }, request.isCurrent);
      if (!request.isCurrent()) return;
      const nextCompilation = data.compilation;
      if (!request.isCurrent()) return;
      const nextSimulation = data.simulation;
      if (!request.isCurrent()) return;
      owner.current.preview = nextCompilation?.status === "READY_FOR_CONFIRMATION" && nextCompilation.candidateFingerprint ? { revision: renderedRevision, compilation: nextCompilation } : null;
      setCompilation(nextCompilation);
      if (!request.isCurrent()) return;
      setSimulation(nextSimulation);
    } catch (requestError) {
      if (!request.isCurrent()) return;
      setError(requestError instanceof Error ? requestError.message : "לא ניתן להכין תצוגה מקדימה");
    } finally {
      if (request.isCurrent()) { owner.current.busy = false; setBusy(false); }
    }
  }

  async function confirm() {
    if (!ownsDraft() || owner.current.busy) return;
    const preview = owner.current.preview;
    if (!preview || preview.revision !== renderedRevision || preview.compilation !== compilation || !compilation?.candidateFingerprint || compilation.status !== "READY_FOR_CONFIRMATION") return;
    const request = beginRequest();
    if (!request) return;
    const submitted = { siteId, text, cameraSourceId, editingRuleId, fingerprint: compilation.candidateFingerprint };
    setError("");
    try {
      const data = await postJson({
        action: "confirm",
        observer_site_id: submitted.siteId,
        text: submitted.text,
        camera_source_id: submitted.cameraSourceId || null,
        editing_rule_id: submitted.editingRuleId,
        candidate_fingerprint: submitted.fingerprint,
        idempotency_key: `watch-confirm-${crypto.randomUUID()}`
      }, request.isCurrent);
      if (!request.isCurrent()) return;
      const nextMessage = data.message;
      if (!request.isCurrent()) return;
      const completed = changeDraft();
      if (!completed || !completed.isCurrent()) return;
      setMessage(nextMessage);
      if (!completed.isCurrent()) return;
      setText("");
      if (!completed.isCurrent()) return;
      setCameraSourceId("");
      if (!completed.isCurrent()) return;
      setEditingRuleId(null);
      if (!completed.isCurrent()) return;
      router.refresh();
    } catch (requestError) {
      if (!request.isCurrent()) return;
      setError(requestError instanceof Error ? requestError.message : "לא ניתן להפעיל את הכלל");
    } finally {
      if (request.isCurrent()) { owner.current.busy = false; setBusy(false); }
    }
  }

  async function changeState(ruleId: string, state: "ACTIVE" | "DISABLED" | "ARCHIVED") {
    const request = beginRequest();
    if (!request) return;
    const submitted = { ruleId, state };
    setError("");
    try {
      const data = await postJson({ action: "set_state", rule_id: submitted.ruleId, state: submitted.state, idempotency_key: `watch-state-${crypto.randomUUID()}` }, request.isCurrent);
      if (!request.isCurrent()) return;
      setMessage(data.message);
      if (!request.isCurrent()) return;
      router.refresh();
    } catch (requestError) {
      if (!request.isCurrent()) return;
      setError(requestError instanceof Error ? requestError.message : "לא ניתן לעדכן את הכלל");
    } finally {
      if (request.isCurrent()) { owner.current.busy = false; setBusy(false); }
    }
  }

  function edit(rule: RuleRow) {
    const draft = changeDraft();
    if (!draft || !draft.isCurrent()) return;
    setEditingRuleId(rule.id);
    if (!draft.isCurrent()) return;
    setText(rule.original_natural_language || rule.title || "");
    if (!draft.isCurrent()) return;
    setMessage("עריכת כלל יוצרת גרסה חדשה לאחר תצוגה מקדימה ואישור.");
    if (!draft.isCurrent()) return;
    const element = document.getElementById("natural-language-rule-builder");
    if (draft.isCurrent()) element?.scrollIntoView({ behavior: "smooth" });
  }

  return <div className="do-page-stack" id="natural-language-rule-builder">
    <form className="do-panel do-form-section do-observer-chat" onSubmit={compile}>
      <div className="do-section-head"><div><h2>על מה תרצו שאשמור?</h2><p>כתבו בשפה רגילה. תחילה תוצג הבנה מסודרת; שום כלל לא יופעל לפני אישור מפורש.</p></div><Sparkles /></div>
      <label className="do-field full"><span>בקשת ניטור</span><textarea rows={4} value={text} onChange={(event) => { if (ownsDraft()) changeText(event.target.value); }} placeholder="למשל: תודיע לי אם אדם נכנס דרך מצלמת הכניסה לבית — ערוץ 11" required minLength={3} maxLength={1200} /></label>
      <label className="do-field"><span>מצלמה, אם תרצו לבחור במפורש</span><select value={cameraSourceId} onChange={(event) => { if (ownsDraft()) changeCamera(event.target.value); }}><option value="">שהתצפיתן יזהה מהטקסט</option>{cameras.map((camera) => <option value={camera.id} key={camera.id}>{camera.display_name || camera.location_label || "מצלמה"}</option>)}</select></label>
      <button className="do-button primary" type="submit" disabled={busy || text.trim().length < 3}>{busy ? <LoaderCircle className="do-spin" /> : <Radar />} {editingRuleId ? "הכנת גרסה חדשה" : "הצגת הפירוש"}</button>
    </form>

    {compilation?.status === "READY_FOR_CONFIRMATION" && compilation.preview ? <section className="do-panel do-form-section">
      <div className="do-section-head"><div><h2>זה מה שהבנתי</h2><p>בדקו את כל התנאים לפני ההפעלה.</p></div><span className="do-badge info">ממתין לאישור</span></div>
      <div className="do-summary-list">
        <div><span>מצלמה</span><strong>{compilation.preview.camera}</strong></div>
        <div><span>אירוע</span><strong>{compilation.preview.event}</strong></div>
        <div><span>זמן</span><strong>{compilation.preview.time}</strong></div>
        <div><span>ימים</span><strong>{compilation.preview.days}</strong></div>
        <div><span>משך</span><strong>{compilation.preview.duration}</strong></div>
        <div><span>כוונת מדיניות</span><strong>{compilation.preview.action}</strong></div>
      </div>
      {simulation ? <div className="do-notice info"><Clock3 /><span><strong>בדיקה היסטורית בלבד: {simulation.matchCount} התאמות</strong><small>מתוך {simulation.evaluatedRealEventCount} אירועי מצלמה אמיתיים שנבדקו ב־{simulation.days} הימים האחרונים. זו אינה הפעלה חיה.</small></span></div> : null}
      <div className="do-notice warn"><ShieldCheck /><span>{compilation.preview.warning} מדיניות פרטיות והקלטה נשארת סמכות עליונה.</span></div>
      <button className="do-button primary" type="button" onClick={() => void confirm()} disabled={busy}>{busy ? <LoaderCircle className="do-spin" /> : <Check />} אישור והפעלת הכלל</button>
    </section> : null}

    {compilation?.status === "NEEDS_CLARIFICATION" && compilation.clarification ? <section className="do-panel do-form-section">
      <div className="do-notice warn"><AlertTriangle /><span><strong>{compilation.clarification.question}</strong><small>לא בחרתי משאב באופן אוטומטי.</small></span></div>
      <div className="do-button-row">{compilation.clarification.options.map((option) => <button type="button" className="do-button secondary" key={option.id} onClick={() => changeCamera(option.id)}>{option.label}</button>)}</div>
    </section> : null}

    {compilation && ["UNSUPPORTED_CAPABILITY", "UNSUPPORTED_ACTION", "INVALID"].includes(compilation.status) ? <div className="do-notice warn"><AlertTriangle /><span><strong>לא נוצר כלל</strong><small>{compilation.unsupported?.explanation || compilation.validation.errors.join(", ")}</small></span></div> : null}
    {message ? <div className="do-action-result success"><Check /> {message}</div> : null}
    {error ? <div className="do-action-result error" role="alert"><AlertTriangle /> {error}</div> : null}

    <section className="do-panel">
      <div className="do-section-head"><div><h2>כללים מהודרים</h2><p>גרסאות מאושרות בלבד. כל התאמה מבוססת על Event אמיתי ונשמרת לביקורת.</p></div><span className="do-badge info">{rules.length}</span></div>
      {rules.length ? <div className="do-row-list">{rules.map((rule) => <div className="do-row" key={rule.id}><Radar /><span className="do-row-main"><strong>{rule.title || "כלל ניטור"}</strong><small>{rule.original_natural_language || "ללא טקסט מקור"}</small><small>גרסה {rule.rule_version || 0} · {rule.compiler_version || "legacy"} · {Number(rule.match_count || 0)} התאמות</small></span><span className="do-row-meta"><b className={rule.rule_state === "ACTIVE" ? "do-badge good" : "do-badge warn"}>{stateLabel(rule.rule_state)}</b>{rule.last_matched_at ? <small>התאמה אחרונה: {new Date(rule.last_matched_at).toLocaleString("he-IL")}</small> : <small>עדיין לא הותאם לאירוע</small>}<span className="do-button-row"><button type="button" className="do-icon-button" aria-label="עריכה" onClick={() => edit(rule)}><Pencil /></button>{rule.rule_state === "ACTIVE" ? <button type="button" className="do-icon-button" aria-label="השבתה" onClick={() => void changeState(rule.id, "DISABLED")} disabled={busy}><PowerOff /></button> : rule.rule_state === "DISABLED" ? <button type="button" className="do-icon-button" aria-label="הפעלה" onClick={() => void changeState(rule.id, "ACTIVE")} disabled={busy}><Power /></button> : null}<button type="button" className="do-icon-button" aria-label="העברה לארכיון" onClick={() => void changeState(rule.id, "ARCHIVED")} disabled={busy || rule.rule_state === "ARCHIVED"}><Archive /></button></span></span></div>)}</div> : <div className="do-empty"><Radar /><strong>אין עדיין כלל מאושר</strong><span>כתבו בקשה, בדקו את הפירוש ואשרו אותה.</span></div>}
    </section>
  </div>;
}
