import Link from "next/link";
import { AlertTriangle, Baby, FileText, HeartPulse, MessageCircle, ShieldCheck, WalletCards } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ChildOperationsPanel } from "@/components/child-operations-panel";
import { ChildPhotoUpload } from "@/components/child-photo-upload";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentRequestActions } from "@/components/parent-request-actions";
import { PrintButton } from "@/components/print-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "-";
}

function age(value?: string | null) {
  if (!value) return "גיל חסר";
  const months = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  return months >= 12 ? `${Math.floor(months / 12)}.${months % 12} שנים` : `${months} חודשים`;
}

export default async function GardenChildProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const { id } = await params;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childRes, feeGroupsRes, journalsRes, incidentsRes, docsRes, messagesRes, requestsRes, paymentHistoryRes] = await Promise.all([
    supabase.from("children" as any).select("*").eq("id", id).eq("garden_id", gardenId).maybeSingle(),
    supabase.from("kindergarten_fee_groups" as any).select("id, group_name, monthly_fee").eq("garden_id", gardenId),
    supabase.from("child_daily_journals" as any).select("*").eq("child_id", id).order("journal_date", { ascending: false }).limit(12),
    supabase.from("incident_reports" as any).select("*").eq("child_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("documents" as any).select("*").eq("child_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("messages" as any).select("*, sender:sender_id(full_name), recipient:recipient_id(full_name)").eq("linked_child_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("parent_child_requests" as any).select("*, parents(full_name, phone), profiles:parent_profile_id(full_name, profile_image_url), recipient:recipient_profile_id(full_name, role, profile_image_url), handler:handled_by(full_name, role)").eq("child_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("child_payment_history" as any).select("*").eq("child_id", id).order("created_at", { ascending: false }).limit(12)
  ]);
  const child = childRes.data as any;
  if (!child) {
    return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="כרטיס ילד"><div className="empty-state"><strong>לא נמצא כרטיס ילד</strong><span>ייתכן שהילד לא שייך לגן שלך או שהכרטיס נמחק.</span><Link className="button primary" href="/dashboard/garden/children">חזרה לילדים</Link></div></DashboardShell>;
  }
  const feeGroups = (feeGroupsRes.data ?? []) as any[];
  const group = feeGroups.find((item) => item.id === child.payment_group_id) ?? feeGroups.find((item) => item.group_name === child.age_group || item.group_name === child.classroom);
  const special = child.custom_monthly_fee !== null && child.custom_monthly_fee !== undefined && (!child.arrangement_valid_until || new Date(child.arrangement_valid_until).getTime() >= Date.now());
  const enriched = {
    ...child,
    fee_group_name: group?.group_name ?? child.classroom ?? child.age_group ?? "ללא קבוצת תשלום",
    group_monthly_fee: group?.monthly_fee ?? child.monthly_fee,
    actual_monthly_fee: special ? Number(child.custom_monthly_fee ?? 0) : Number(group?.monthly_fee ?? child.monthly_fee ?? 0),
    has_special_arrangement: special
  };
  const journals = (journalsRes.data ?? []) as any[];
  const requests = (requestsRes.data ?? []) as any[];
  const incidents = (incidentsRes.data ?? []) as any[];
  const payments = (paymentHistoryRes.data ?? []) as any[];
  const [enrollmentsRes, timelineRes] = child.permanent_child_file_id ? await Promise.all([
    supabase.from("child_kindergarten_enrollments" as any).select("id, garden_id, status, start_date, end_date, classroom_name, notes, gardens(name, city)").eq("permanent_child_file_id", child.permanent_child_file_id).order("created_at", { ascending: false }),
    supabase.from("child_timeline_events" as any).select("id, event_type, title, description, garden_id, created_at, gardens(name)").eq("permanent_child_file_id", child.permanent_child_file_id).order("created_at", { ascending: false }).limit(20)
  ]) : [{ data: [] }, { data: [] }] as any;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="כרטיס ילד">
      <section className="dashboard-section printable-report">
        <div className="dashboard-hero-card garden-hero-card child-profile-hero">
          <Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" />
          <div><p className="eyebrow">Child Operating Profile</p><h1>{child.full_name}</h1><p>{age(child.birth_date)} · {child.classroom ?? child.age_group ?? "קבוצה לא הוגדרה"} · {child.status ?? "פעיל"}</p></div>
          <div className="profile-badge-row"><span className={child.allergies ? "pill bad" : "pill good"}><HeartPulse size={14} /> {child.allergies ? "אלרגיה" : "בריאות תקינה"}</span><span className={child.has_change_clothes === false ? "pill bad" : "pill good"}><Baby size={14} /> {child.has_change_clothes === false ? "חסר בגדים" : "יש בגדים"}</span><span className={child.payment_status === "paid" ? "pill good" : "pill warn"}><WalletCards size={14} /> {child.payment_status ?? "תשלום"}</span></div>
        </div>
        <div className="profile-actions"><Link className="button secondary" href="/dashboard/garden/children">חזרה לילדים</Link><Link className="button secondary" href={`/dashboard/garden/messages?childId=${child.id}`}>הודעה להורה</Link><PrintButton label="הדפסת כרטיס ילד / PDF" /></div>
        <div className="child-profile-tabs">{["Overview", "Health", "Parents", "Payments", "Daily Journal", "Incidents", "Media", "Documents", "Messages/Requests", "Timeline"].map((tab) => <span key={tab}>{tab}</span>)}</div>
        <div className="grid cols-4 dashboard-kpis">
          <div className="card stat-card">תשלום בפועל <b>₪{enriched.actual_monthly_fee}</b></div>
          <div className="card stat-card">חוב <b>₪{child.debt_amount ?? 0}</b></div>
          <div className="card stat-card">יומנים <b>{journals.length}</b></div>
          <div className="card stat-card">פניות פתוחות <b>{requests.filter((item) => !["handled", "rejected"].includes(item.status)).length}</b></div>
        </div>
      </section>

      <ChildOperationsPanel child={enriched} gardenId={gardenId} />

      <section className="grid cols-2 dashboard-panels">
        <ChildPhotoUpload childId={child.id} initialUrl={child.photo_url ?? child.face_image_url} />
        <article className="card action-panel"><h2><HeartPulse size={18} /> בריאות - צפייה בלבד לצוות</h2><p>מידע רפואי רגיש נערך על ידי ההורה בלבד. מנהלת/צוות יכולים לצפות ולסמן צורך בבדיקה.</p><div className="risk-list"><div>קופת חולים <b>{child.hmo ?? "-"}</b></div><div>אלרגיות <b>{child.allergies || "אין"}</b></div><div>תרופות <b>{child.regular_medications || "אין"}</b></div><div>הערות <b>{child.medical_notes || "-"}</b></div></div></article>
        <article className="card action-panel"><h2><WalletCards size={18} /> תשלומים</h2><div className="risk-list"><div>קבוצת תשלום <b>{enriched.fee_group_name}</b></div><div>מחיר קבוצה <b>₪{enriched.group_monthly_fee ?? 0}</b></div><div>הסדר מיוחד <b>{enriched.has_special_arrangement ? `₪${child.custom_monthly_fee}` : "אין"}</b></div><div>עצירת תשלומים <b>{child.payments_paused ? child.paused_reason ?? "פעיל" : "לא"}</b></div><div>תוקף עד <b>{dateText(child.valid_until)}</b></div></div></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><h2><MessageCircle size={18} /> בקשות הורים</h2>{requests.length === 0 ? <div className="empty-mini">אין בקשות מיוחדות מהורים.</div> : <div className="procedure-list">{requests.map((request) => <div className="list-item parent-request-item" key={request.id}><div><strong>{request.request_type}</strong><span>{request.content}</span><small>{request.profiles?.full_name ?? request.parents?.full_name ?? "הורה"} · אל: {request.recipient_label ?? request.recipient?.full_name ?? request.recipient_role_group ?? "מנהלת הגן"} · {new Date(request.created_at).toLocaleString("he-IL")} · {request.status}</small>{request.response_text ? <p>תגובה: {request.response_text}</p> : null}<ParentRequestActions childId={child.id} requestId={request.id} /></div></div>)}</div>}</article>
        <article className="card action-panel"><h2><AlertTriangle size={18} /> אירועים</h2>{incidents.length === 0 ? <div className="empty-mini">אין אירועים פתוחים לילד.</div> : incidents.map((incident) => <div className="list-item" key={incident.id}><div><strong>{incident.title}</strong><span>{incident.description}</span></div><span className={incident.severity === "critical" ? "pill bad" : "pill warn"}>{incident.severity}</span></div>)}</article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><h2>יומן יומי אחרון</h2>{journals.length === 0 ? <div className="empty-mini">אין יומנים שמורים.</div> : journals.map((journal) => <div className="list-item" key={journal.id}><div><strong>{dateText(journal.journal_date)}</strong><span>{journal.mood ?? "-"} · {journal.sleep_summary ?? "-"} · {journal.notes_to_parents ?? ""}</span></div></div>)}</article>
        <article className="card action-panel"><h2><FileText size={18} /> מסמכים והיסטוריית תשלום</h2>{(docsRes.data ?? []).length === 0 ? <div className="empty-mini">אין מסמכי ילד.</div> : (docsRes.data ?? []).map((doc: any) => <div className="list-item" key={doc.id}><strong>{doc.name ?? doc.document_type}</strong><span className="pill">{doc.status}</span></div>)}<hr />{payments.map((payment) => <div className="list-item" key={payment.id}><strong>₪{payment.amount_paid ?? payment.amount}</strong><span>{payment.transaction_type ?? payment.action} · {dateText(payment.paid_at)}</span></div>)}</article>
      </section>
      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><h2>היסטוריית גנים</h2>{(enrollmentsRes.data ?? []).length === 0 ? <div className="empty-mini">אין היסטוריית שיוכים נוספת.</div> : (enrollmentsRes.data ?? []).map((enrollment: any) => <div className="list-item" key={enrollment.id}><div><strong>{enrollment.gardens?.name ?? "גן ילדים"}</strong><span>{dateText(enrollment.start_date)} - {dateText(enrollment.end_date)} · {enrollment.classroom_name ?? "ללא קבוצה"}</span><small>{enrollment.notes ?? ""}</small></div><span className={enrollment.status === "active" ? "pill good" : enrollment.status === "transferred" ? "pill" : "pill warn"}>{enrollment.status}</span></div>)}</article>
        <article className="card action-panel"><h2>ציר זמן תיק ילד</h2>{(timelineRes.data ?? []).length === 0 ? <div className="empty-mini">אין אירועי ציר זמן נוספים.</div> : (timelineRes.data ?? []).map((event: any) => <div className="list-item" key={event.id}><div><strong>{event.title}</strong><span>{event.description ?? ""}</span><small>{event.gardens?.name ?? "מערכת"} · {event.created_at ? new Date(event.created_at).toLocaleString("he-IL") : ""}</small></div></div>)}</article>
      </section>
    </DashboardShell>
  );
}
