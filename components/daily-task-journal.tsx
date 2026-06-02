"use client";

import { useMemo, useState } from "react";

type Row = Record<string, any>;

export function DailyTaskJournal({ tasks, completions, gardenId }: { tasks: Row[]; completions: Row[]; gardenId?: string | null }) {
  const [done, setDone] = useState(() => new Set(completions.map((item) => item.operational_task_id)));
  const [message, setMessage] = useState<string | null>(null);
  const completionRate = useMemo(() => tasks.length ? Math.round((done.size / tasks.length) * 100) : 0, [done, tasks.length]);

  async function complete(task: Row) {
    const response = await fetch("/api/daily-operational-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operational_task_id: task.id, garden_id: gardenId ?? task.garden_id ?? undefined })
    });
    if (response.ok) {
      setDone((current) => new Set([...current, task.id]));
      setMessage("המשימה סומנה כהושלמה ונשמרה בהיסטוריה.");
    }
  }

  const byFrequency = ["daily", "weekly", "monthly"].map((frequency) => ({ frequency, rows: tasks.filter((task) => task.frequency === frequency) }));
  return <>
    {message ? <div className="success-banner">{message}</div> : null}
    <section className="card action-panel">
      <h2>יומן תפעול</h2>
      <p>צ׳קליסט יומי, שבועי וחודשי שמותאם לתפעול גן ילדים פרטי בישראל: בטיחות, נוכחות, היגיינה, מטבח, תרופות, חירום ועדכוני הורים.</p>
      <div className="progress-bar"><span style={{ width: `${completionRate}%` }} /></div>
      <div className="control-metrics"><span><b>{completionRate}%</b> הושלם</span><span><b>{done.size}/{tasks.length}</b> משימות</span><span><b>{tasks.length - done.size}</b> באיחור/ממתינות</span></div>
    </section>
    {byFrequency.map((group) => <section className="card action-panel" key={group.frequency}><h2>{group.frequency === "daily" ? "משימות יומיות" : group.frequency === "weekly" ? "משימות שבועיות" : "משימות חודשיות"}</h2>{group.rows.length === 0 ? <div className="empty-mini">אין משימות בקבוצה זו.</div> : group.rows.map((task) => <div className="checklist-row" key={task.id}><label><input type="checkbox" checked={done.has(task.id)} onChange={() => complete(task)} /> <strong>{task.title}</strong><span>{task.description}</span></label><span className="pill">{task.category}</span></div>)}</section>)}
  </>;
}
