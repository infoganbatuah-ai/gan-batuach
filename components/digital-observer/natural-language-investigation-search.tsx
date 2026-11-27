"use client";

import { useState } from "react";
import { AlertTriangle, Braces, CalendarClock, Camera, CheckCircle2, Clock3, FileVideo2, ListTree, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import type { InvestigationSearchResult } from "@/lib/domain/digital-observer/investigation-results";

import type { IncidentReconstructions, InvestigationRecordingTimeline } from "@/lib/domain/digital-observer/investigation-recording-timeline";

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
  reportPreviews?: { incidentId: string; contentSha256: string }[];
  incidentReconstructions?: IncidentReconstructions;
  recordingTimeline?: InvestigationRecordingTimeline;
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

function localTime(value: string, timeZone: string, withSeconds = false) {
  return new Intl.DateTimeFormat("he-IL", { timeZone, dateStyle: "short", timeStyle: withSeconds ? "medium" : "short" }).format(new Date(value));
}

export function NaturalLanguageInvestigationSearch({ observerSiteId, siteName, adminMode = false }: { observerSiteId: string; siteName: string; adminMode?: boolean }) {
  const [question, setQuestion] = useState(examples[0]);
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [submittedSearch, setSubmittedSearch] = useState<{ question: string; cameraSourceId?: string } | null>(null);
  const [timelineSource, setTimelineSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(options: { cameraSourceId?: string; cursor?: number } = {}) {
    const search = options.cursor == null ? { question, cameraSourceId: options.cameraSourceId } : submittedSearch;
    if (busy || exporting || !search || search.question.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/digital-observer/investigation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ observer_site_id: observerSiteId, question: search.question, camera_source_id: search.cameraSourceId, cursor: options.cursor ?? 0, limit: 20 })
      });
      const body = await response.json() as { data?: ApiPayload; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "לא ניתן לבצע את החיפוש כרגע");
      setPayload(body.data);
      setSubmittedSearch(search);
      setTimelineSource("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "לא ניתן לבצע את החיפוש כרגע");
    } finally {
      setBusy(false);
    }
  }

  async function downloadReport(incidentId: string, contentSha256: string) {
    if (!submittedSearch || !payload?.result || busy || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const response = await fetch("/api/digital-observer/investigation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          observer_site_id: observerSiteId, question: submittedSearch.question,
          camera_source_id: submittedSearch.cameraSourceId, cursor: payload.result.pagination.cursor, limit: 20,
          report: { incident_id: incidentId, content_sha256: contentSha256 },
        }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error || "לא ניתן להוריד את הדוח.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "observer-incident-report.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "לא ניתן להוריד את הדוח.");
    } finally {
      setExporting(false);
    }
  }

  const result = payload?.result;
  const timeZone = result?.query.timeZone ?? "Asia/Jerusalem";

  const timeline = payload?.recordingTimeline ?? [];
  const timelineSources = new Map(timeline.map((row) => [row.sourceId, row.sourceLabel]));
  const reconstructionsById = new Map(payload?.incidentReconstructions?.map((item) => [item.incidentId, item]) ?? []);
  const reportPreviewsById = new Map(payload?.reportPreviews?.map((item) => [item.incidentId, item.contentSha256]) ?? []);
  const eventsById = new Map(result?.events.map((event) => [event.id, event]) ?? []);
  const visibleTimeline = timelineSource ? timeline.filter((row) => row.sourceId === timelineSource) : timeline;

  return <div className="do-page-stack" id="natural-language-investigation">
    <section className="do-panel">
      <div className="do-section-head"><div><h2>מה תרצו לבדוק?</h2><p>החיפוש קורא רק אירועים, תקריות וראיות מורשות שנשמרו באתר {siteName}. הוא אינו מנתח וידאו פרטי בשירות חיצוני ואינו מנחש זהות.</p></div><Search /></div>
      <form className="do-form-section" onSubmit={(event) => { event.preventDefault(); void run(); }}>
        <label className="do-field"><span>שאלת חקירה</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} maxLength={500} placeholder="לדוגמה: מה קרה בכניסה אתמול בלילה?" /></label>
        <div className="do-button-row"><button className="do-button primary" type="submit" disabled={busy || exporting || question.trim().length < 2}>{busy ? <LoaderCircle className="do-spin" /> : <Search />} חיפוש בנתוני אמת</button></div>
      </form>
      <div className="do-button-row">{examples.map((example) => <button className="do-button secondary" type="button" key={example} onClick={() => setQuestion(example)}>{example}</button>)}</div>
      <div className="do-notice info"><ShieldCheck /><span><strong>חיפוש היסטורי ומוגבל</strong><small>אין SQL חופשי, אין פעולה במצלמה, אין זיהוי פנים ואין טענה לכיסוי וידאו רציף.</small></span></div>
      {error ? <div className="do-notice warn"><AlertTriangle /><span>{error}</span></div> : null}
    </section>

    {payload?.compilation.clarification ? <section className="do-panel">
      <div className="do-section-head"><div><h2>נדרשת בחירה</h2><p>{payload.compilation.clarification.question}</p></div><Camera /></div>
      <div className="do-button-row">{payload.compilation.clarification.choices.map((choice) => <button className="do-button secondary" key={choice.id} type="button" onClick={() => void run({ cameraSourceId: choice.id })}>{choice.label}</button>)}</div>
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

      {timeline.length ? <section className="do-panel">
        <div className="do-section-head"><div><h2>ציר זמן לפי מצלמה</h2><p>האירועים בתוצאות מסודרים מזמן מוקדם למאוחר. שליפה מארכיון המקליט עדיין אינה זמינה.</p></div><CalendarClock /></div>
        {timelineSources.size > 1 ? <label className="do-field"><span>מצלמה בתוצאות העמוד</span>
          <select value={timelineSource} onChange={(event) => setTimelineSource(event.target.value)}>
            <option value="">כל המצלמות בתוצאות</option>
            {Array.from(timelineSources, ([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label> : null}
        <ol className="do-row-list">{visibleTimeline.map((row) => {
          const event = eventsById.get(row.eventId);
          return <li className="do-row" key={row.eventId}>
            <Clock3 /><span className="do-row-main"><strong>{row.label} · {row.sourceLabel}</strong>
              <small>{localTime(row.occurredAt, timeZone)} · {evidenceLabels[row.evidenceState]}{event?.confidence == null ? "" : ` · ${Math.round(event.confidence * 100)}% ביטחון זיהוי`}</small>
              {row.timeBasis === "TIME_DISAGREEMENT" ? <small>זמן התצפית שונה מהזמן השמור.</small> : null}
              {row.timeBasis === "STORED_TIME_ONLY" ? <small>זמן הרשומה מוצג. זמן המקור חסר.</small> : null}
              {row.candidate ? <small>טווח לבדיקה בארכיון · {localTime(row.candidate.fromInclusive, timeZone, true)} עד {localTime(row.candidate.toExclusive, timeZone, true)}</small> : null}
            </span>
            {event?.evidence.playbackPath ? <span className="do-row-meta"><a className="do-link" href={event.evidence.playbackPath} target="_blank" rel="noreferrer">פתיחת ראיית אירוע</a></span> : null}
          </li>;
        })}</ol>
      </section> : null}

      {result.incidents.map((incident) => {
        const reconstruction = reconstructionsById.get(incident.id);
        const reportDigest = reportPreviewsById.get(incident.id);
        return <article className="do-panel" key={incident.id}>
          <div className="do-section-head"><div><h2>{incident.title}</h2><p>{incident.summary}</p></div><span className="do-badge info">{incident.status}</span></div>
          <div className="do-summary-list">
            <div><span>מצלמה</span><strong>{incident.cameraName}</strong></div>
            <div><span>זמן</span><strong>{localTime(incident.lastActivityAt, timeZone)}</strong></div>
            <div><span>סיכון</span><strong>{incident.risk.score == null ? "לא הוערך" : `${incident.risk.score}/100 · ${incident.risk.band}`}</strong></div>
            <div><span>אימות</span><strong>{incident.verification.status ?? "לא זמין"}{incident.verification.confidence == null ? "" : ` · ${Math.round(incident.verification.confidence * 100)}%`}</strong></div>
            <div><span>החלטה</span><strong>{incident.decision.final ?? incident.decision.current ?? "לא נוצרה"}</strong></div>
            <div><span>ראיות</span><strong>{incident.evidence.states.map((state) => evidenceLabels[state] ?? state).join(", ")}</strong></div>
          </div>
          {reconstruction ? <>
            <h3>תצפיות בתקרית לפי זמן</h3>
            <p>התצפיות אינן מוכיחות זהות אדם או מסלול תנועה.</p>
            {reconstruction.groups.length ? reconstruction.groups.map((group) => <section key={group.startsAt}>
              <p>{localTime(group.startsAt, timeZone, true)}{group.endsAt !== group.startsAt ? ` עד ${localTime(group.endsAt, timeZone, true)}` : ""} · {group.sourceCount} מקורות</p>
              {group.sourceCount > 1 ? <small>סנכרון השעונים בין המצלמות לא אומת. הקיבוץ משקף סמיכות זמנים בלבד.</small> : null}
              <ol className="do-row-list">{group.observations.map((observation) => <li className="do-row" key={observation.eventId}>
                <Clock3 /><span className="do-row-main"><strong>{observation.label} · {observation.sourceLabel}</strong>
                  <small>{localTime(observation.observedAt, timeZone, true)} · {evidenceLabels[observation.evidenceState]}</small>
                  {observation.timeBasis === "TIME_DISAGREEMENT" ? <small>זמן התצפית שונה מהזמן השמור. הפרש השעונים לא נמדד.</small> : null}
                  {observation.timeBasis === "STORED_TIME_ONLY" ? <small>זמן הרשומה מוצג. זמן המקור חסר.</small> : null}
                </span>
                {observation.evidencePath ? <span className="do-row-meta"><a className="do-link" href={observation.evidencePath} target="_blank" rel="noreferrer">פתיחת ראיית אירוע</a></span> : null}
              </li>)}</ol>
            </section>) : <p>אין תצפיות מקושרות שניתן למקם בציר הזמן בתוצאות החיפוש.</p>}
            {reconstruction.omittedObservations > 0 ? <small>{reconstruction.omittedObservations} רשומות מהסיכום לא שובצו בגלל זמן, מקור או קישור שלא אומתו.</small> : null}
            {reconstruction.partialSearch || reconstruction.capped ? <p>מוצג שחזור חלקי לפי תוצאות החיפוש הזמינות.</p> : null}
          </> : null}
          <div className="do-button-row"><a className="do-button secondary" href={`/digital-observer/incidents?site=${incident.siteId}&incident=${incident.id}`}>פתיחת התקרית</a>{!reconstruction && incident.evidence.playbackPaths[0] ? <a className="do-button primary" href={incident.evidence.playbackPaths[0]} target="_blank" rel="noreferrer"><FileVideo2 /> פתיחת ראיה מורשית</a> : null}
            {reportDigest ? <button className="do-button secondary" type="button" disabled={busy || exporting}
              onClick={() => void downloadReport(incident.id, reportDigest)}>הורדת דוח תצפיות JSON</button> : null}
          </div>
        </article>;
      })}

      {payload?.recordingTimeline && timeline.length < result.events.length ? <div className="do-notice info"><Clock3 /><span>חלק מהאירועים לא שובצו בציר הזמן כי הזמן או המקור אינם מאומתים.</span></div> : null}
      {!payload?.recordingTimeline && result.events.length ? <section className="do-panel"><div className="do-section-head"><div><h2>אירועים עובדתיים</h2><p>Track הוא רצף תצפיות ואינו זהות של אדם.</p></div><CalendarClock /></div><div className="do-row-list">{result.events.map((event) => <div className="do-row" key={event.id}><Camera /><span className="do-row-main"><strong>{event.label} · {event.cameraName}</strong><small>{localTime(event.occurredAt, timeZone)} · {event.confidence == null ? "ללא ציון ביטחון" : `${Math.round(event.confidence * 100)}% ביטחון זיהוי`} · {evidenceLabels[event.evidence.state]}</small></span><span className="do-row-meta">{event.evidence.playbackPath ? <a className="do-link" href={event.evidence.playbackPath} target="_blank" rel="noreferrer">פתיחת ראיה</a> : null}</span></div>)}</div></section> : null}

      {result.coverage.scanCapReached ? <div className="do-notice warn"><AlertTriangle /><span>החיפוש הגיע לתקרת הסריקה. מומלץ לצמצם את טווח הזמן או לבחור מצלמה.</span></div> : null}
      {result.pagination.nextCursor != null ? <button className="do-button secondary" type="button" disabled={busy || exporting} onClick={() => void run({ cursor: result.pagination.nextCursor! })}>העמוד הבא</button> : null}
      {adminMode && payload?.debug ? <details className="do-observer-insight-disclosure"><summary><span><Braces /><b>תוכנית חיפוש ו-Grounding</b><small>Admin בלבד</small></span></summary><pre>{JSON.stringify(payload.debug, null, 2)}</pre></details> : null}
    </> : null}
  </div>;
}
