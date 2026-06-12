"use client";

import { useState } from "react";

type Survey = { id: string; title?: string | null };
type Event = { id: string; title?: string | null };

async function post(payload: Record<string, unknown>) {
  const response = await fetch("/api/parent/trust-center", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

export function ParentTrustCenterActions({ surveys, events }: { surveys: Survey[]; events: Event[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function submit(form: HTMLFormElement, payload: Record<string, unknown>, success: string) {
    setBusy(String(payload.action));
    setMessage("");
    try {
      await post(payload);
      form.reset();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="grid cols-2 dashboard-panels">
      {message ? <div className={message.includes("נכשלה") || message.includes("לא ") ? "error-banner" : "success-banner"}>{message}</div> : null}
      <form className="card form" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        void submit(form, {
          action: "feedback",
          feedback_type: data.get("feedback_type"),
          title: data.get("title"),
          body: data.get("body")
        }, "המשוב נשלח לגן");
      }}>
        <h2>משוב לגן</h2>
        <div className="form-grid">
          <label>סוג<select name="feedback_type"><option value="suggestion">הצעה</option><option value="compliment">מחמאה</option><option value="concern">דאגה</option><option value="complaint">תלונה</option></select></label>
          <label>כותרת<input name="title" required /></label>
          <label className="wide">פירוט<textarea name="body" rows={3} /></label>
        </div>
        <button className="button primary" disabled={busy === "feedback"}>שליחה</button>
      </form>

      <form className="card form" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        void submit(form, {
          action: "request",
          request_type: data.get("request_type"),
          title: data.get("title"),
          body: data.get("body")
        }, "הבקשה נשלחה");
      }}>
        <h2>בקשה מהגן</h2>
        <div className="form-grid">
          <label>סוג<select name="request_type"><option value="document_request">בקשת מסמך</option><option value="information_request">בקשת מידע</option><option value="meeting_request">בקשת פגישה</option></select></label>
          <label>כותרת<input name="title" required /></label>
          <label className="wide">פירוט<textarea name="body" rows={3} /></label>
        </div>
        <button className="button primary" disabled={busy === "request"}>שליחת בקשה</button>
      </form>

      <form className="card form" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        void submit(form, {
          action: "survey_response",
          survey_id: data.get("survey_id"),
          response_data: {
            satisfaction: data.get("satisfaction"),
            comment: data.get("comment")
          }
        }, "המענה לסקר נשמר");
      }}>
        <h2>סקר הורים</h2>
        <div className="form-grid">
          <label>סקר<select name="survey_id" required>{surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title}</option>)}</select></label>
          <label>שביעות רצון<select name="satisfaction"><option value="5">5 - מצוין</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></label>
          <label className="wide">הערה<textarea name="comment" rows={3} /></label>
        </div>
        <button className="button primary" disabled={busy === "survey_response" || surveys.length === 0}>שליחת סקר</button>
      </form>

      <form className="card form" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        void submit(form, {
          action: "participation",
          calendar_event_id: data.get("calendar_event_id") || undefined,
          participation_type: data.get("participation_type"),
          body: data.get("body")
        }, "ההשתתפות נשמרה");
      }}>
        <h2>השתתפות בקהילה</h2>
        <div className="form-grid">
          <label>אירוע<select name="calendar_event_id"><option value="">כללי</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
          <label>סוג<select name="participation_type"><option value="event_participation">השתתפות באירוע</option><option value="volunteering">התנדבות</option><option value="activity_involvement">פעילות בגן</option></select></label>
          <label className="wide">הערה<textarea name="body" rows={3} /></label>
        </div>
        <button className="button primary" disabled={busy === "participation"}>שמירה</button>
      </form>
    </section>
  );
}
