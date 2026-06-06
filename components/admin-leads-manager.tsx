"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type LeadRow = {
  id: string;
  lead_type: string;
  parent_name?: string | null;
  garden_name?: string | null;
  owner_name?: string | null;
  manager_name?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: string | null;
};

type GardenRow = {
  id: string;
  name: string;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  manager_id?: string | null;
  status?: string | null;
  approval_flow_status?: string | null;
  final_approval_status?: string | null;
  admin_correction_note?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

type Props = {
  leads: LeadRow[];
  gardens?: GardenRow[];
};

const labels: Record<string, string> = {
  lead_submitted: "בקשה חדשה",
  lead_review: "צריך ליצור קשר",
  lead_approved: "אושר ליד",
  credentials_sent: "נשלחו פרטי כניסה",
  onboarding_in_progress: "המנהלת משלימה",
  onboarding_submitted: "נשלח לאישור",
  pending_final_approval: "ממתין לאישור סופי",
  lead_approved_credentials_sent: "נשלחו פרטי כניסה",
  profile_incomplete: "ממתין להשלמת מנהלת",
  pending_final_admin_approval: "ממתין לאישור סופי",
  correction_required: "נדרש תיקון",
  active: "פעיל",
  suspended: "מושהה",
  archived: "בארכיון"
};

async function postAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/kindergarten-approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data ?? body;
}

function GardenCard({ garden, onDone }: { garden: GardenRow; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState(garden.admin_correction_note ?? "");
  async function act(action: string, success: string) {
    setBusy(action);
    try {
      const result = await postAction({ action, garden_id: garden.id, note });
      onDone(result?.credentials ? `נשלחו פרטים: ${result.credentials.username}` : success);
    } catch (error) {
      onDone(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      setBusy("");
    }
  }
  const status = garden.approval_flow_status ?? garden.status ?? "profile_incomplete";
  return (
    <article className="card procedure-card product-flow-card">
      <div>
        <span className={status === "active" ? "pill good" : status === "correction_required" ? "pill warn" : "pill"}>{labels[status] ?? status}</span>
        <h3>{garden.name}</h3>
        <p>{garden.city || "עיר לא צוינה"} · {garden.profiles?.full_name || "מנהלת גן"} · {garden.email || garden.phone || "אין פרטי קשר"}</p>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="הערה למנהלת במקרה של תיקונים" />
      </div>
      <div className="procedure-meta">
        {["credentials_sent", "onboarding_in_progress", "correction_required", "lead_approved_credentials_sent", "profile_incomplete"].includes(status) ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => act("resend_credentials", "פרטי הכניסה נשלחו שוב")}>שליחה חוזרת</button> : null}
        {["pending_final_approval", "onboarding_submitted", "pending_final_admin_approval"].includes(status) ? <button className="button primary" disabled={Boolean(busy)} onClick={() => act("approve_final_profile", "הגן אושר")}>אישור סופי</button> : null}
        {["pending_final_approval", "onboarding_submitted", "pending_final_admin_approval"].includes(status) ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => act("request_corrections", "הוחזר לתיקונים")}>החזרה לתיקון</button> : null}
        {status === "active" ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => act("suspend", "הגן הושהה")}>השהיה</button> : null}
        {status !== "active" && status !== "archived" ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => act("archive", "הועבר לארכיון")}>ארכוב</button> : null}
      </div>
    </article>
  );
}

function LeadCard({ lead, onDone }: { lead: LeadRow; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function approve() {
    setBusy(true);
    try {
      const result = await postAction({ action: "approve_lead", lead_id: lead.id });
      onDone(`נוצרו פרטי כניסה: ${result.credentials?.username ?? "נשלח למנהלת"}`);
    } catch (error) {
      onDone(error instanceof Error ? error.message : "האישור נכשל");
    } finally {
      setBusy(false);
    }
  }
  async function leadAction(action: "request_contact" | "reject_lead", success: string) {
    setBusy(true);
    try {
      await postAction({ action, lead_id: lead.id });
      onDone(success);
    } catch (error) {
      onDone(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="card procedure-card product-flow-card">
      <div>
        <span className="pill warn">{labels[lead.status ?? "lead_submitted"] ?? lead.status ?? "בקשה חדשה"}</span>
        <h3>{lead.garden_name || "גן חדש"}</h3>
        <p>{lead.city || "עיר לא צוינה"} · {lead.manager_name || lead.owner_name || "איש קשר"} · {lead.email || lead.phone || "אין פרטי קשר"}</p>
        <small>{lead.notes || ""}</small>
      </div>
      <div className="procedure-meta">
        <button className="button primary" disabled={busy} onClick={approve}>אישור ושליחת כניסה</button>
        <button className="button secondary" disabled={busy} onClick={() => leadAction("request_contact", "סומן ליצירת קשר")}>צריך קשר</button>
        <button className="button secondary" disabled={busy} onClick={() => leadAction("reject_lead", "הליד הועבר לארכיון")}>ארכוב</button>
      </div>
    </article>
  );
}

function FlowSection({ title, hint, children, empty }: { title: string; hint: string; children: ReactNode; empty: boolean }) {
  return (
    <section className="dashboard-section flow-board-section">
      <div className="section-heading"><h2>{title}</h2><p>{hint}</p></div>
      {empty ? <div className="empty-state"><strong>אין פריטים כרגע</strong><span>כשהסטטוס יתאים, הוא יופיע כאן.</span></div> : <div className="procedure-list">{children}</div>}
    </section>
  );
}

export function AdminLeadsManager({ leads, gardens = [] }: Props) {
  const [message, setMessage] = useState("");
  const gardenLeads = leads.filter((lead) => lead.lead_type === "garden" && ["new", "new_garden_onboarding", "lead_submitted"].includes(String(lead.status ?? "new")));
  const reviewLeads = leads.filter((lead) => lead.lead_type === "garden" && String(lead.status) === "lead_review");
  const credentialsSent = gardens.filter((garden) => ["credentials_sent", "lead_approved_credentials_sent"].includes(String(garden.approval_flow_status ?? garden.status)));
  const inProgress = gardens.filter((garden) => ["onboarding_in_progress", "profile_incomplete"].includes(String(garden.approval_flow_status ?? garden.status)));
  const pendingFinal = gardens.filter((garden) => ["pending_final_approval", "onboarding_submitted", "pending_final_admin_approval"].includes(String(garden.approval_flow_status ?? garden.status)));
  const corrections = gardens.filter((garden) => String(garden.approval_flow_status ?? garden.status) === "correction_required");
  const active = gardens.filter((garden) => String(garden.approval_flow_status ?? garden.status) === "active");
  const suspended = gardens.filter((garden) => String(garden.approval_flow_status ?? garden.status) === "suspended");

  return (
    <>
      {message ? <div className={message.includes("נכשל") || message.includes("לא ") ? "error-banner" : "success-banner"}>{message}</div> : null}
      <FlowSection title="בקשות גן חדשות" hint="בודקים בקשה ראשונית ושולחים פרטי כניסה למנהלת." empty={gardenLeads.length === 0}>
        {gardenLeads.map((lead) => <LeadCard lead={lead} onDone={setMessage} key={lead.id} />)}
      </FlowSection>
      <FlowSection title="צריך ליצור קשר" hint="בקשות שדורשות שיחה קצרה לפני אישור." empty={reviewLeads.length === 0}>
        {reviewLeads.map((lead) => <LeadCard lead={lead} onDone={setMessage} key={lead.id} />)}
      </FlowSection>
      <FlowSection title="נשלחו פרטי כניסה" hint="המנהלת כבר יכולה להתחבר ולהשלים את פרופיל הגן." empty={credentialsSent.length === 0}>
        {credentialsSent.map((garden) => <GardenCard garden={garden} onDone={setMessage} key={garden.id} />)}
      </FlowSection>
      <FlowSection title="בתהליך השלמה" hint="המנהלת עובדת על פרופיל הגן." empty={inProgress.length === 0}>
        {inProgress.map((garden) => <GardenCard garden={garden} onDone={setMessage} key={garden.id} />)}
      </FlowSection>
      <FlowSection title="ממתינים לאישור סופי" hint="הפרופיל הושלם ונשלח לבדיקה שלך." empty={pendingFinal.length === 0}>
        {pendingFinal.map((garden) => <GardenCard garden={garden} onDone={setMessage} key={garden.id} />)}
      </FlowSection>
      <FlowSection title="נדרשים תיקונים" hint="הגן חזר למנהלת עם הערה ברורה." empty={corrections.length === 0}>
        {corrections.map((garden) => <GardenCard garden={garden} onDone={setMessage} key={garden.id} />)}
      </FlowSection>
      <FlowSection title="גנים פעילים" hint="גנים שעברו אישור סופי ועלו לאוויר." empty={active.length === 0}>
        {active.slice(0, 12).map((garden) => <GardenCard garden={garden} onDone={setMessage} key={garden.id} />)}
      </FlowSection>
      <FlowSection title="מושהים" hint="גנים שנעצרו ולא זמינים לעבודה רגילה." empty={suspended.length === 0}>
        {suspended.map((garden) => <GardenCard garden={garden} onDone={setMessage} key={garden.id} />)}
      </FlowSection>
    </>
  );
}
