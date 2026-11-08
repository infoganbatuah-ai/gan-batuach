"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, Braces, CalendarClock, Camera, CheckCircle2, Clock3, FileVideo2, ListTree, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import type { InvestigationSearchResult } from "@/lib/domain/digital-observer/investigation-results";

type Compilation = {
  status: string;
  compilerVersion: string;
  preview: { scope: string; cameras: string; period: string; filters: string } | null;
  clarification: { question: string; choices: { id: string; label: string }[] } | null;
  limitation: { code: string; explanation: string } | null;
};

type ApiPayload = {
  status: string;
  compilation: Compilation;
  result: (InvestigationSearchResult & { queryLatencyMs: number }) | null;
  debug: Record<string, unknown> | null;
};

const examples = [
  "תראה לי את הכניסות דרך מצלמת הכניסה היום",
  "מה קרה בתקרית האחרונה בכניסה?",
  "באילו תקריות הייתה החלטת VERIFY השבוע?"
];

const evidenceLabels: Record<string, string> = {
  AVAILABLE: "ראיה זמינה",
  NO_RECORDING_BY_POLICY: "ללא הקלטה לפי המדיניות",
  EXPIRED: "הראיה פגה לפי מדיניות השמירה",
  FAILED: "יצירת הראיה נכשלה",
  UNAVAILABLE: "ראיה אינה זמינה"
};

function localTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function NaturalLanguageInvestigationSearch({ observerSiteId, siteName, adminMode = false }: { observerSiteId: string; siteName: string; adminMode?: boolean }) {
  return <ScopedNaturalLanguageInvestigationSearch key={observerSiteId} observerSiteId={observerSiteId} siteName={siteName} adminMode={adminMode} />;
}

type InvestigationView = { payload: ApiPayload; question: string; cameraSourceId: string | undefined; revision: number };

function ScopedNaturalLanguageInvestigationSearch({ observerSiteId, siteName, adminMode = false }: Parameters<typeof NaturalLanguageInvestigationSearch>[0]) {
  const [question, setQuestion] = useState(examples[0]);
  const [view, setView] = useState<InvestigationView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderedRevision, setRenderedRevision] = useState(0);
  const owner = useRef({ active: true, revision: 0, operation: 0, busy: false, resetBusy: false, view: null as InvestigationView | null });
  useLayoutEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    if (lifetime.resetBusy) { lifetime.resetBusy = false; setBusy(false); }
    return () => { lifetime.resetBusy = lifetime.busy; lifetime.active = false; lifetime.operation += 1; lifetime.busy = false; };
  }, []);
  const payload = view?.payload ?? null;
  const ownsQuestion = () => owner.current.active && owner.current.revision === renderedRevision;
  const ownsResult = () => ownsQuestion() && view !== null && owner.current.view === view && view.revision === renderedRevision;
  function changeQuestion(next: string) {
    if (!ownsQuestion()) return;
    const lifetime = owner.current;
    lifetime.revision += 1;
    lifetime.operation += 1;
    lifetime.busy = false;
    lifetime.resetBusy = false;
    lifetime.view = null;
    setRenderedRevision(lifetime.revision);
    setQuestion(next);
    setView(null);
    setBusy(false);
    setError(null);
  }

  async function run(options: { cameraSourceId?: string; cursor?: number } = {}, expectedView?: InvestigationView) {
    if (!ownsQuestion() || owner.current.busy || question.trim().length < 2) return;
    if (expectedView && (!ownsResult() || view !== expectedView)) return;
    const submitted = {
      observerSiteId,
      question: expectedView ? expectedView.question : question,
      cameraSourceId: options.cameraSourceId ?? expectedView?.cameraSourceId,
      cursor: options.cursor ?? 0
    };
    const lifetime = owner.current;
    lifetime.busy = true;
    const operation = ++lifetime.operation;
    const isCurrent = () => lifetime.active && lifetime.operation === operation && lifetime.revision === renderedRevision;
    setBusy(true);
    setError(null);
    try {
      if (!isCurrent()) return;
      const response = await fetch("/api/digital-observer/investigation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ observer_site_id: submitted.observerSiteId, question: submitted.question, camera_source_id: submitted.cameraSourceId, cursor: submitted.cursor, limit: 20 })
      });
      if (!isCurrent()) return;
      const body = await response.json() as { data?: ApiPayload; error?: string };
      if (!isCurrent()) return;
      if (!response.ok || !body.data) throw new Error(body.error || "לא ניתן לבצע את החיפוש כרגע");
      if (!isCurrent()) return;
      const next = { payload: body.data, question: submitted.question, cameraSourceId: submitted.cameraSourceId, revision: renderedRevision };
      if (!isCurrent()) return;
      lifetime.view = next;
      setView(next);
    } catch (requestError) {
      if (!isCurrent()) return;
      setError(requestError instanceof Error ? requestError.message : "לא ניתן לבצע את החיפוש כרגע");
    } finally {
      if (isCurrent()) { lifetime.busy = false; setBusy(false); }
    }
  }

  const result = payload?.result;
  const timeZone = result?.query.timeZone ?? "Asia/Jerusalem";

  return <div className="do-page-stack" id="natural-language-investigation">
    <section className="do-panel">
      <div className="do-section-head"><div><h2>מה תרצו לבדוק?</h2><p>החיפוש קורא רק אירועים, תקריות וראיות מורשות שנשמרו באתר {siteName}. הוא אינו מנתח וידאו פרטי בשירות חיצוני ואינו מנחש זהות.</p></div><Search /></div>
      <form className="do-form-section" onSubmit={(event) => { if (!ownsQuestion()) return; event.preventDefault(); void run(); }}>
        <label className="do-field"><span>שאלת חקירה</span><textarea value={question} onChange={(event) => { if (ownsQuestion()) changeQuestion(event.target.value); }} rows={3} maxLength={500} placeholder="לדוגמה: מה קרה בכניסה אתמול בלילה?" /></label>
        <div className="do-button-row"><button className="do-button primary" type="submit" disabled={busy || question.trim().length < 2}>{busy ? <LoaderCircle className="do-spin" /> : <Search />} חיפוש בנתוני אמת</button></div>
      </form>
      <div className="do-button-row">{examples.map((example) => <button className="do-button secondary" type="button" key={example} onClick={() => changeQuestion(example)}>{example}</button>)}</div>
      <div className="do-notice info"><ShieldCheck /><span><strong>חיפוש היסטורי ומוגבל</strong><small>אין SQL חופשי, אין פעולה במצלמה, אין זיהוי פנים ואין טענה לכיסוי וידאו רציף.</small></span></div>
      {error ? <div className="do-notice warn"><AlertTriangle /><span>{error}</span></div> : null}
    </section>

    {payload?.compilation.clarification ? <section className="do-panel">
      <div className="do-section-head"><div><h2>נדרשת בחירה</h2><p>{payload.compilation.clarification.question}</p></div><Camera /></div>
      <div className="do-button-row">{payload.compilation.clarification.choices.map((choice) => <button className="do-button secondary" key={choice.id} type="button" onClick={() => { if (ownsResult() && view) void run({ cameraSourceId: choice.id }, view); }}>{choice.label}</button>)}</div>
    </section> : null}

    {payload?.compilation.limitation ? <div className="do-notice warn"><AlertTriangle /><span><strong>אין אפשרות לענות על החלק הזה</strong><small>{payload.compilation.limitation.explanation}</small></span></div> : null}

    {payload?.compilation.preview ? <section className="do-panel">
      <div className="do-section-head"><div><h2>כך פורש החיפוש</h2><p>הפירוש נבדק מול סכימה מוגבלת לפני קריאת הנתונים.</p></div><Braces /></div>
      <div className="do-summary-list">
        <div><span>מקור</span><strong>{payload.compilation.preview.cameras}</strong></div>
        <div><span>תקופה</span><strong>{payload.compilation.preview.period}</strong></div>
        <div><span>סוגי רשומות</span><strong>{payload.compilation.preview.scope}</strong></div>
        <div><span>מסננים</span><strong>{payload.compilation.preview.filters}</strong></div>
      </div>
    </section> : null}

    {result ? <>
      <div className="do-notice info"><CheckCircle2 /><span><strong>{result.answer}</strong><small>התשובה נתמכת ב-{result.grounding.incidentIds.length} תקריות, {result.grounding.eventIds.length} אירועים ו-{result.grounding.evidenceIds.length} רשומות ראיה.</small></span></div>
      <section className="do-business-summary">
        <article className="do-metric"><ListTree /><strong>{result.incidents.length}</strong><span>תקריות בתוצאה</span></article>
        <article className="do-metric"><CalendarClock /><strong>{result.events.length}</strong><span>אירועים בתוצאה</span></article>
        <article className="do-metric"><FileVideo2 /><strong>{result.grounding.evidenceIds.length}</strong><span>ראיות מקושרות</span></article>
        <article className="do-metric"><Clock3 /><strong>{result.queryLatencyMs}ms</strong><span>זמן שאילתה</span></article>
      </section>

      {result.incidents.map((incident) => <article className="do-panel" key={incident.id}>
        <div className="do-section-head"><div><h2>{incident.title}</h2><p>{incident.summary}</p></div><span className="do-badge info">{incident.status}</span></div>
        <div className="do-summary-list">
          <div><span>מצלמה</span><strong>{incident.cameraName}</strong></div>
          <div><span>זמן</span><strong>{localTime(incident.lastActivityAt, timeZone)}</strong></div>
          <div><span>סיכון</span><strong>{incident.risk.score == null ? "לא הוערך" : `${incident.risk.score}/100 · ${incident.risk.band}`}</strong></div>
          <div><span>אימות</span><strong>{incident.verification.status ?? "לא זמין"}{incident.verification.confidence == null ? "" : ` · ${Math.round(incident.verification.confidence * 100)}%`}</strong></div>
          <div><span>החלטה</span><strong>{incident.decision.final ?? incident.decision.current ?? "לא נוצרה"}</strong></div>
          <div><span>ראיות</span><strong>{incident.evidence.states.map((state) => evidenceLabels[state] ?? state).join(", ")}</strong></div>
        </div>
        {incident.timeline.length ? <div className="do-row-list">{incident.timeline.map((entry) => <div className="do-row" key={entry.eventId}><Clock3 /><span className="do-row-main"><strong>{entry.label}</strong><small>{localTime(entry.timestamp, timeZone)} · {evidenceLabels[entry.evidenceState] ?? entry.evidenceState}</small></span></div>)}</div> : null}
        <div className="do-button-row"><a className="do-button secondary" href={`/digital-observer/incidents?site=${incident.siteId}&incident=${incident.id}`}>פתיחת התקרית</a>{incident.evidence.playbackPaths[0] ? <a className="do-button primary" href={incident.evidence.playbackPaths[0]} target="_blank" rel="noreferrer"><FileVideo2 /> פתיחת ראיה מורשית</a> : null}</div>
      </article>)}

      {result.events.length ? <section className="do-panel"><div className="do-section-head"><div><h2>אירועים עובדתיים</h2><p>Track הוא רצף תצפיות ואינו זהות של אדם.</p></div><CalendarClock /></div><div className="do-row-list">{result.events.map((event) => <div className="do-row" key={event.id}><Camera /><span className="do-row-main"><strong>{event.label} · {event.cameraName}</strong><small>{localTime(event.occurredAt, timeZone)} · {event.confidence == null ? "ללא ציון ביטחון" : `${Math.round(event.confidence * 100)}% ביטחון זיהוי`} · {evidenceLabels[event.evidence.state]}</small></span><span className="do-row-meta">{event.evidence.playbackPath ? <a className="do-link" href={event.evidence.playbackPath} target="_blank" rel="noreferrer">פתיחת ראיה</a> : null}</span></div>)}</div></section> : null}

      {result.coverage.scanCapReached ? <div className="do-notice warn"><AlertTriangle /><span>החיפוש הגיע לתקרת הסריקה. מומלץ לצמצם את טווח הזמן או לבחור מצלמה.</span></div> : null}
      {result.pagination.nextCursor != null ? <button className="do-button secondary" type="button" disabled={busy} onClick={() => { if (ownsResult() && view) void run({ cursor: result.pagination.nextCursor!, cameraSourceId: view.cameraSourceId }, view); }}>העמוד הבא</button> : null}
      {adminMode && payload?.debug ? <details className="do-observer-insight-disclosure"><summary><span><Braces /><b>תוכנית חיפוש ו-Grounding</b><small>Admin בלבד</small></span></summary><pre>{JSON.stringify(payload.debug, null, 2)}</pre></details> : null}
    </> : null}
  </div>;
}
