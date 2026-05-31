"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CheckCircle2, MessageCircleWarning, XCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";

type TransferRequest = Record<string, any>;

const statusLabels: Record<string, string> = {
  pending_new_kindergarten_review: "ממתין לאישור הגן החדש",
  pending_current_kindergarten_response: "ממתין לתגובת הגן הקיים",
  current_kindergarten_acknowledged: "הגן הקיים אישר סיום שיוך",
  current_kindergarten_requested_call: "הגן הקיים ביקש שיחה",
  current_kindergarten_flagged: "הגן הקיים סימן שיש בעיה",
  missing_details: "נדרשת השלמת פרטים",
  approved: "אושר",
  rejected: "נדחה",
  cancelled: "בוטל"
};

const actionLabels: Record<string, string> = {
  approve_new_kindergarten: "אישור קליטה",
  request_missing_details: "בקשת השלמת פרטים",
  reject_new_kindergarten: "דחייה",
  acknowledge_current_transfer: "אישור סיום שיוך / מעבר",
  request_parent_call: "בקשת שיחה עם ההורה",
  flag_current_issue: "סימון שיש בעיה"
};

export function GardenChildTransferRequestsPanel({
  incoming,
  outgoing
}: {
  incoming: TransferRequest[];
  outgoing: TransferRequest[];
}) {
  const router = useRouter();
  const [incomingRows, setIncomingRows] = useState(incoming);
  const [outgoingRows, setOutgoingRows] = useState(outgoing);
  const [message, setMessage] = useState("");
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setIncomingRows(incoming);
    setOutgoingRows(outgoing);
  }, [incoming, outgoing]);

  async function act(requestId: string, action: string) {
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/garden/child-transfer-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: noteById[requestId] ?? "" })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.error ?? "עדכון בקשת המעבר נכשל");
        return;
      }
      setMessage("בקשת המעבר עודכנה בהצלחה.");
      const terminalActions = new Set(["approve_new_kindergarten", "reject_new_kindergarten", "acknowledge_current_transfer"]);
      if (terminalActions.has(action)) {
        setIncomingRows((current) => current.filter((request) => request.id !== requestId));
        setOutgoingRows((current) => current.filter((request) => request.id !== requestId));
      }
      router.refresh();
    });
  }

  function renderRequest(request: TransferRequest, mode: "incoming" | "outgoing") {
    const child = request.target_child ?? request.child ?? {};
    const file = request.permanent_child_files ?? {};
    const childName = child.full_name ?? file.full_name ?? "ילד/ה";
    const photo = child.photo_url ?? child.face_image_url ?? file.photo_url ?? file.face_image_url;
    return (
      <article className="person-card lead-request-card transfer-request-card" key={request.id}>
        <div className="person-card-top">
          <Avatar name={childName} src={photo} size="lg" />
          <div>
            <span className={request.status === "approved" ? "pill good" : request.status === "rejected" ? "pill bad" : "pill warn"}>{statusLabels[request.status] ?? request.status}</span>
            <h3>{mode === "incoming" ? "בקשת קליטת ילד קיים" : "בקשת מעבר / סיום שיוך"}</h3>
            <p>{childName} · {request.parent?.full_name ?? request.parent_name ?? "הורה"}</p>
          </div>
        </div>
        <div className="profile-badge-row">
          <span className="pill">גן קיים: {request.current_garden?.name ?? "לא צוין"}</span>
          <span className="pill">גן חדש: {request.target_garden?.name ?? "לא צוין"}</span>
          <span className="pill">תאריך התחלה: {request.requested_start_date ? new Date(request.requested_start_date).toLocaleDateString("he-IL") : "לא נקבע"}</span>
        </div>
        <details className="profile-expand" open>
          <summary>סיכום תיק ילד והיסטוריה</summary>
          <div className="profile-details-grid">
            <section><h4>בריאות</h4><p>{child.allergies ? `אלרגיות: ${child.allergies}` : file.allergies ? `אלרגיות: ${file.allergies}` : "לא דווחה אלרגיה."}</p><p>{child.medical_notes ?? file.medical_notes ?? "אין הערות רפואיות מיוחדות."}</p></section>
            <section><h4>אנשי קשר ואיסוף</h4><p>{child.emergency_phone ?? file.emergency_phone ?? "טלפון חירום לא צוין"}</p><p>{Array.isArray(child.pickup_authorized ?? file.pickup_authorized) ? `${(child.pickup_authorized ?? file.pickup_authorized).length} מורשי איסוף` : "מורשי איסוף לפי תיק ההורה"}</p></section>
            <section><h4>הערת הורה</h4><p>{request.parent_notes || "אין הערה נוספת"}</p></section>
            <section><h4>פרטיות</h4><p>הגן החדש רואה רק נתוני זהות, בריאות, אנשי קשר, איסוף ומסמכים שההורה סיפק. הערות פנימיות של גן קודם לא מועברות אוטומטית.</p></section>
          </div>
        </details>
        <label className="wide">הערה לתיעוד
          <textarea rows={2} value={noteById[request.id] ?? ""} onChange={(event) => setNoteById((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="סיבת אישור/דחייה, בקשת שיחה או הערה פנימית" />
        </label>
        <div className="profile-actions">
          {mode === "incoming" ? (
            <>
              <button className="button primary tiny" disabled={pending} type="button" onClick={() => act(request.id, "approve_new_kindergarten")}><CheckCircle2 size={14} /> {actionLabels.approve_new_kindergarten}</button>
              <button className="button secondary tiny" disabled={pending} type="button" onClick={() => act(request.id, "request_missing_details")}><MessageCircleWarning size={14} /> {actionLabels.request_missing_details}</button>
              <button className="button danger tiny" disabled={pending} type="button" onClick={() => act(request.id, "reject_new_kindergarten")}><XCircle size={14} /> {actionLabels.reject_new_kindergarten}</button>
            </>
          ) : (
            <>
              <button className="button primary tiny" disabled={pending} type="button" onClick={() => act(request.id, "acknowledge_current_transfer")}><CheckCircle2 size={14} /> {actionLabels.acknowledge_current_transfer}</button>
              <button className="button secondary tiny" disabled={pending} type="button" onClick={() => act(request.id, "request_parent_call")}><MessageCircleWarning size={14} /> {actionLabels.request_parent_call}</button>
              <button className="button danger tiny" disabled={pending} type="button" onClick={() => act(request.id, "flag_current_issue")}><XCircle size={14} /> {actionLabels.flag_current_issue}</button>
            </>
          )}
        </div>
      </article>
    );
  }

  const hasRequests = incomingRows.length > 0 || outgoingRows.length > 0;

  return (
    <section className="dashboard-section transfer-requests-section">
      <div className="section-heading">
        <h2><ArrowLeftRight size={18} /> בקשות מעבר וקליטת ילדים קיימים</h2>
        <p>כאן מנהלים מעבר חכם בין גנים: תיק הילד נשמר, הגן החדש מאשר קליטה, והגן הקיים יכול לתעד תגובה בלי לחסום את ההורה לנצח.</p>
      </div>
      {message ? <div className={message.includes("בהצלחה") ? "success-banner" : "error-banner"}>{message}</div> : null}
      {!hasRequests ? (
        <div className="empty-state">
          <strong>אין בקשות מעבר כרגע</strong>
          <span>כאשר הורה יבחר ילד קיים ויבקש לרשום אותו לגן אחר, הבקשה תופיע כאן עם כל פרטי הקליטה הדרושים.</span>
        </div>
      ) : (
        <div className="grid cols-2 dashboard-panels">
          <div>
            <h3>בקשות קליטת ילדים קיימים</h3>
            <div className="people-card-grid">{incomingRows.length ? incomingRows.map((request) => renderRequest(request, "incoming")) : <div className="empty-mini">אין בקשות קליטה לגן הזה.</div>}</div>
          </div>
          <div>
            <h3>בקשות מעבר / סיום שיוך</h3>
            <div className="people-card-grid">{outgoingRows.length ? outgoingRows.map((request) => renderRequest(request, "outgoing")) : <div className="empty-mini">אין בקשות מעבר מילדים שעוזבים כרגע.</div>}</div>
          </div>
        </div>
      )}
    </section>
  );
}
