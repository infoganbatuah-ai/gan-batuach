"use client";

import { useState, type FormEvent } from "react";
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

async function postJson(body: unknown) {
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
  const payload = await response.json().catch(() => ({}));
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
  const router = useRouter();
  const [text, setText] = useState("");
  const [cameraSourceId, setCameraSourceId] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [compilation, setCompilation] = useState<Compilation | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function compile(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (text.trim().length < 3 || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await postJson({
        action: "compile",
        observer_site_id: siteId,
        text,
        camera_source_id: cameraSourceId || null,
        editing_rule_id: editingRuleId
      });
      setCompilation(data.compilation);
      setSimulation(data.simulation);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "לא ניתן להכין תצוגה מקדימה");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!compilation?.candidateFingerprint || compilation.status !== "READY_FOR_CONFIRMATION" || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson({
        action: "confirm",
        observer_site_id: siteId,
        text,
        camera_source_id: cameraSourceId || null,
        editing_rule_id: editingRuleId,
        candidate_fingerprint: compilation.candidateFingerprint,
        idempotency_key: `watch-confirm-${crypto.randomUUID()}`
      });
      setMessage(data.message);
      setText("");
      setCameraSourceId("");
      setEditingRuleId(null);
      setCompilation(null);
      setSimulation(null);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "לא ניתן להפעיל את הכלל");
    } finally {
      setBusy(false);
    }
  }

  async function changeState(ruleId: string, state: "ACTIVE" | "DISABLED" | "ARCHIVED") {
    setBusy(true);
    setError("");
    try {
      const data = await postJson({ action: "set_state", rule_id: ruleId, state, idempotency_key: `watch-state-${crypto.randomUUID()}` });
      setMessage(data.message);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "לא ניתן לעדכן את הכלל");
    } finally {
      setBusy(false);
    }
  }

  function edit(rule: RuleRow) {
    setEditingRuleId(rule.id);
    setText(rule.original_natural_language || rule.title || "");
    setCompilation(null);
    setSimulation(null);
    setMessage("עריכת כלל יוצרת גרסה חדשה לאחר תצוגה מקדימה ואישור.");
    document.getElementById("natural-language-rule-builder")?.scrollIntoView({ behavior: "smooth" });
  }

  return <div className="do-page-stack" id="natural-language-rule-builder">
    <form className="do-panel do-form-section do-observer-chat" onSubmit={compile}>
      <div className="do-section-head"><div><h2>על מה תרצו שאשמור?</h2><p>כתבו בשפה רגילה. תחילה תוצג הבנה מסודרת; שום כלל לא יופעל לפני אישור מפורש.</p></div><Sparkles /></div>
      <label className="do-field full"><span>בקשת ניטור</span><textarea rows={4} value={text} onChange={(event) => { setText(event.target.value); setCompilation(null); }} placeholder="למשל: תודיע לי אם אדם נכנס דרך מצלמת הכניסה לבית — ערוץ 11" required minLength={3} maxLength={1200} /></label>
      <label className="do-field"><span>מצלמה, אם תרצו לבחור במפורש</span><select value={cameraSourceId} onChange={(event) => { setCameraSourceId(event.target.value); setCompilation(null); }}><option value="">שהתצפיתן יזהה מהטקסט</option>{cameras.map((camera) => <option value={camera.id} key={camera.id}>{camera.display_name || camera.location_label || "מצלמה"}</option>)}</select></label>
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
      <div className="do-button-row">{compilation.clarification.options.map((option) => <button type="button" className="do-button secondary" key={option.id} onClick={() => { setCameraSourceId(option.id); setCompilation(null); }}>{option.label}</button>)}</div>
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
