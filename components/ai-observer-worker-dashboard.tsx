"use client";

import { useState } from "react";

type Row = Record<string, any>;

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

function statusTone(status?: string) {
  if (status === "failed" || status === "error" || status === "offline") return "bad";
  if (status === "running" || status === "queued" || status === "retrying") return "warn";
  return "good";
}

export function AiObserverWorkerDashboard({ workers, jobs, logs, rules, zones, gardens, cameras }: { workers: Row[]; jobs: Row[]; logs: Row[]; rules: Row[]; zones: Row[]; gardens: Row[]; cameras: Row[] }) {
  const [jobRows, setJobRows] = useState(jobs);
  const [ruleRows, setRuleRows] = useState(rules);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedGardenId, setSelectedGardenId] = useState(gardens[0]?.id ?? "");

  async function runMock(formData: FormData) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const data = await postJson("/api/admin/ai-observer/run-mock-job", {
        action: "run",
        kindergarten_id: String(formData.get("kindergarten_id") || "") || undefined,
        camera_id: String(formData.get("camera_id") || "") || undefined,
        rule_key: String(formData.get("rule_key") || "") || undefined
      });
      setJobRows((current) => [data.job, ...current.filter((job) => job.id !== data.job.id)]);
      setMessage("Mock observer job רץ ונשמר. אם rule עבר threshold/cooldown נוצר אירוע תצפיתן.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "הרצת mock נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function retry(job: Row) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const data = await postJson("/api/admin/ai-observer/run-mock-job", { action: "retry", job_id: job.id });
      setJobRows((current) => current.map((row) => row.id === data.job.id ? data.job : row));
      setMessage("Mock observer job הורץ שוב.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry נכשל");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule: Row) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const data = await postJson(`/api/admin/ai-observer/rules/${rule.id}/toggle`, { enabled: !rule.enabled });
      setRuleRows((current) => current.map((row) => row.id === rule.id ? data.rule : row));
      setMessage(data.rule.enabled ? "החוק הופעל" : "החוק הושבת");
    } catch (err) {
      setError(err instanceof Error ? err.message : "עדכון חוק נכשל");
    } finally {
      setBusy(false);
    }
  }

  const filteredCameras = cameras.filter((camera) => !selectedGardenId || camera.garden_id === selectedGardenId);

  return (
    <div className="stack">
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>Workers</span><strong>{workers.length}</strong></article>
        <article className="card metric-card"><span>Queued / Running</span><strong>{jobRows.filter((job) => ["queued", "running", "retrying"].includes(job.status)).length}</strong></article>
        <article className="card metric-card"><span>Failed</span><strong>{jobRows.filter((job) => job.status === "failed").length}</strong></article>
        <article className="card metric-card"><span>Camera zones</span><strong>{zones.length}</strong></article>
      </section>

      <form className="form-card compact-form" action={runMock}>
        <div>
          <p className="eyebrow">Mock worker only</p>
          <h2>הרצת Observer Job מדומה</h2>
          <p>הפעולה אינה מעבדת וידאו אמיתי. היא בודקת queue, rule cooldown, יצירת אירוע והתראה למנהלת/אדמין.</p>
        </div>
        <div className="form-grid three">
          <label>גן<select name="kindergarten_id" value={selectedGardenId} onChange={(event) => setSelectedGardenId(event.target.value)}><option value="">בחירה אוטומטית</option>{gardens.map((garden) => <option value={garden.id} key={garden.id}>{garden.name}</option>)}</select></label>
          <label>מצלמה<select name="camera_id"><option value="">בחירה אוטומטית</option>{filteredCameras.map((camera) => <option value={camera.id} key={camera.id}>{camera.name}</option>)}</select></label>
          <label>Rule<select name="rule_key"><option value="">ברירת מחדל</option>{ruleRows.map((rule) => <option value={rule.rule_key} key={rule.id}>{rule.rule_key}</option>)}</select></label>
        </div>
        <button className="button primary" disabled={busy}>הרצת mock job</button>
      </form>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>Workers</h2>
          {workers.length === 0 ? <div className="empty-mini">אין workers.</div> : workers.map((worker) => <div className="list-item" key={worker.id}><div><strong>{worker.name}</strong><span>{worker.worker_type} · {worker.last_run_at ?? "טרם רץ"}</span></div><span className={`pill ${statusTone(worker.status)}`}>{worker.status}</span></div>)}
        </article>
        <article className="card action-panel">
          <h2>Rules</h2>
          {ruleRows.length === 0 ? <div className="empty-mini">אין rules.</div> : ruleRows.map((rule) => <div className="list-item" key={rule.id}><div><strong>{rule.rule_key}</strong><span>{rule.event_type} · threshold {rule.threshold} · cooldown {rule.cooldown_seconds}s</span></div><button className="button secondary tiny" disabled={busy} onClick={() => toggleRule(rule)}>{rule.enabled ? "השבתה" : "הפעלה"}</button></div>)}
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Observer Jobs</h2><p>סטטוס queue, retry, תוצאה ולוגיקה מדומה.</p></div>
        {jobRows.length === 0 ? <div className="empty-state"><strong>אין jobs עדיין</strong><span>הריצו mock job כדי לבדוק את התשתית.</span></div> : <div className="procedure-list">{jobRows.map((job) => <article className="card procedure-card" key={job.id}><div><span className={`pill ${statusTone(job.status)}`}>{job.status}</span><h3>{job.job_type}</h3><p>{job.gardens?.name ?? job.kindergarten_id} · {job.camera_streams?.name ?? "מצלמה אוטומטית"}</p><small>retry {job.retry_count}/{job.max_retries} · priority {job.priority}</small>{job.failure_reason ? <p>{job.failure_reason}</p> : null}</div><div className="procedure-meta">{job.result_event_id ? <a className="button secondary" href="/dashboard/admin/ai-events">אירוע שנוצר</a> : <span className="pill">ללא אירוע</span>}{job.status === "failed" ? <button className="button secondary" disabled={busy} onClick={() => retry(job)}>Retry</button> : null}</div></article>)}</div>}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>Recent logs</h2>
          {logs.length === 0 ? <div className="empty-mini">אין logs.</div> : logs.map((log) => <div className="list-item" key={log.id}><div><strong>{log.message}</strong><span>{log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : ""}</span>{log.failure_reason ? <span>{log.failure_reason}</span> : null}</div><span className={`pill ${statusTone(log.level === "error" ? "failed" : log.level)}`}>{log.level}</span></div>)}
        </article>
        <article className="card action-panel">
          <h2>Camera zones</h2>
          {zones.length === 0 ? <div className="empty-mini">אין zones. המיגרציה תיצור default zones למצלמות קיימות.</div> : zones.slice(0, 12).map((zone) => <div className="list-item" key={zone.id}><div><strong>{zone.name}</strong><span>{zone.zone_type} · {zone.camera_streams?.name ?? "כללי"}</span></div><span className={zone.is_restricted ? "pill warn" : "pill good"}>{zone.is_restricted ? "מוגבל" : "רגיל"}</span></div>)}
        </article>
      </section>
    </div>
  );
}
