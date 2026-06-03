"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";

type Contact = {
  id: string;
  full_name: string;
  relation: string;
  child_id: string;
  children?: { full_name?: string | null } | null;
};

type MatchResult = {
  id: string;
  match_score?: number | null;
  confidence?: number | null;
  provider?: string | null;
  review_status: string;
  notes?: string | null;
  created_at?: string | null;
  authorized_pickup_contacts?: { full_name?: string | null; relation?: string | null } | null;
  children?: { full_name?: string | null } | null;
};

export function FaceMatchReviewPanel({ contacts, results }: { contacts: Contact[]; results: MatchResult[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function post(payload: Record<string, unknown>) {
    setMessage(null);
    const response = await fetch("/api/garden/face-match-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "הפעולה נכשלה");
      return;
    }
    setMessage("נשמר. נדרש תמיד אישור אנושי לפני איסוף.");
    router.refresh();
  }

  function createMock(formData: FormData) {
    startTransition(() => void post({ action: "create_mock", pickup_contact_id: formData.get("pickup_contact_id") }));
  }

  function review(id: string, review_status: string) {
    startTransition(() => void post({ action: "review", id, review_status, notes: "Review מנהלת. אין החלטה ביומטרית אוטומטית." }));
  }

  return (
    <div className="stack">
      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><UserCheck /><strong>{contacts.length}</strong><span>מורשי איסוף</span></article>
        <article className="metric-card"><Camera /><strong>{results.length}</strong><span>תוצאות mock</span></article>
        <article className="metric-card"><ShieldAlert /><strong>{results.filter((result) => result.review_status === "possible_match" || result.review_status === "pending_review").length}</strong><span>דורש review</span></article>
        <article className="metric-card"><ShieldCheck /><strong>0</strong><span>שחרור אוטומטי</span></article>
      </section>

      {message ? <div className={message.includes("נכשלה") ? "notice warning" : "notice success"}>{message}</div> : null}

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading">
            <h2>יצירת התאמת mock</h2>
            <p>הדגמה בלבד. אין provider אמיתי ואין החלטה ביומטרית.</p>
          </div>
          <form action={createMock} className="form-grid compact-form">
            <label className="form-field full">
              <span>מורשה איסוף</span>
              <select name="pickup_contact_id" required>
                <option value="">בחירה</option>
                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name} · {contact.children?.full_name ?? "ילד/ה"}</option>)}
              </select>
            </label>
            <button className="button primary full" disabled={isPending}>יצירת possible match mock</button>
          </form>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>מדיניות פרטיות</h2><p>ציונים אינם מוצגים להורים ואינם משחררים ילד. מנהלת חייבת לאשר או לדחות ידנית.</p></div>
          <div className="risk-list">
            <div>No automatic release <b>required</b></div>
            <div>No biometric decision <b>required</b></div>
            <div>Human review <b>required</b></div>
            <div>Parent-facing scores <b>blocked</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>תוצאות התאמה</h2><p>אפשרות התאמה היא רק כלי עזר ל-review.</p></div>
        {results.length === 0 ? <div className="empty-state"><strong>אין תוצאות face match</strong><span>צרו mock כדי לבדוק את זרימת ה-review.</span></div> : (
          <div className="procedure-list">
            {results.map((result) => (
              <article className="card procedure-card" key={result.id}>
                <div>
                  <span className={result.review_status.includes("approved") ? "pill good" : result.review_status.includes("rejected") ? "pill bad" : "pill warn"}>{result.review_status}</span>
                  <span className="pill">{result.provider ?? "mock"}</span>
                  <h3>{result.authorized_pickup_contacts?.full_name ?? "אדם לא מזוהה"}</h3>
                  <p>{result.children?.full_name ?? "ילד/ה"} · score {Number(result.match_score ?? 0).toFixed(2)} · confidence {Number(result.confidence ?? 0).toFixed(2)}</p>
                  <small>{result.notes ?? "אין הערות"}</small>
                </div>
                <div className="procedure-meta">
                  <button className="button secondary" disabled={isPending} onClick={() => review(result.id, "approved_by_manager")}>אישור מנהלת</button>
                  <button className="button danger" disabled={isPending} onClick={() => review(result.id, "rejected_by_manager")}>דחייה</button>
                  <button className="button secondary" disabled={isPending} onClick={() => review(result.id, "inconclusive")}>לא חד משמעי</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
