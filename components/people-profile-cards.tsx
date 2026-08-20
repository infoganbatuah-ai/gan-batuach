"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Baby, Bell, CalendarClock, FileText, HeartPulse, MessageCircle, Phone, Printer, Search, ShieldCheck, Shirt, UserCheck, WandSparkles } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ChildPaymentActions } from "@/components/child-payment-actions";
import { QuickChildOps } from "@/components/quick-child-ops";

type Row = Record<string, any>;

function ageFromBirthDate(value?: string | null) {
  if (!value) return "גיל חסר";
  const birth = new Date(value);
  const months = Math.max(0, Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years ? `${years}.${rest} שנים` : `${rest} חודשים`;
}

function statusClass(status?: string | boolean | null) {
  if (status === true || status === "active" || status === "present" || status === "valid" || status === "approved" || status === "done") return "pill good";
  if (status === "missing" || status === "expired" || status === "rejected" || status === "late" || status === false) return "pill bad";
  return "pill warn";
}

function formatDate(value?: string | null) {
  if (!value) return "לא תועד";
  return new Date(value).toLocaleDateString("he-IL");
}

function riskLevel(score: number) {
  if (score >= 70) return { className: "risk-chip bad", label: "סיכון גבוה" };
  if (score >= 35) return { className: "risk-chip warn", label: "דורש תשומת לב" };
  return { className: "risk-chip good", label: "תקין" };
}

function paymentClass(status?: string | null) {
  if (status === "paid") return "pill good";
  if (status === "due_soon" || status === "partial" || status === "discount" || status === "special_arrangement") return "pill warn";
  if (status === "overdue" || status === "unpaid") return "pill bad";
  return "pill";
}

function Timeline({ items }: { items: Array<{ title: string; meta: string; tone?: "good" | "warn" | "bad" }> }) {
  return <div className="profile-timeline">{items.map((item, index) => <div className={`timeline-dot-row ${item.tone ?? "good"}`} key={`${item.title}-${index}`}><i /><div><strong>{item.title}</strong><span>{item.meta}</span></div></div>)}</div>;
}

function Toolbar({ query, setQuery, filter, setFilter, sort, setSort, filterOptions }: { query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void; sort: string; setSort: (value: string) => void; filterOptions: string[] }) {
  return (
    <div className="people-toolbar">
      <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שם, כיתה, סטטוס או הערה" /></label>
      <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">כל הסטטוסים</option>{filterOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select>
      <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">מיון לפי שם</option><option value="risk">סיכון / טיפול קודם</option><option value="recent">עודכן לאחרונה</option></select>
    </div>
  );
}

export function ChildrenProfileCards({ children }: { children: Row[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("risk");
  const [viewMode, setViewMode] = useState<"cards" | "compact" | "attention">("cards");
  const rows = useMemo(() => children.filter((child) => {
    const text = `${child.full_name} ${child.mother_name ?? ""} ${child.father_name ?? ""} ${child.status} ${child.class_group ?? ""} ${child.classroom ?? ""} ${child.age_group ?? ""} ${child.allergies ?? ""} ${child.hmo ?? ""} ${child.payment_status ?? ""}`.toLowerCase();
    const attention = Boolean(child.allergies || child.medical_notes || child.has_change_clothes === false || child.open_parent_requests || ["overdue", "unpaid", "partial"].includes(child.payment_status) || child.attendance_status === "not_updated");
    return (!query || text.includes(query.toLowerCase())) && (!filter || child.status === filter || child.attendance_status === filter || child.payment_status === filter || child.age_group === filter || child.classroom === filter) && (viewMode !== "attention" || attention);
  }).sort((a, b) => {
    if (sort === "risk") return Number(Boolean(b.allergies) || b.incident_count || b.attendance_status === "late") - Number(Boolean(a.allergies) || a.incident_count || a.attendance_status === "late");
    if (sort === "recent") return new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    return String(a.full_name).localeCompare(String(b.full_name), "he");
  }), [children, query, filter, sort, viewMode]);
  const filters = Array.from(new Set(children.flatMap((child) => [child.status, child.attendance_status, child.payment_status, child.age_group, child.classroom]).filter(Boolean)));

  return (
    <section className="dashboard-section people-directory">
      <div className="section-heading"><h2>כרטיסי ילדים חכמים</h2><p>בריאות, נוכחות, מצב רוח, איסוף, יומן יומי ותיעוד הורים בכרטיס אחד.</p></div>
      <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} filterOptions={filters} />
      <div className="view-mode-switch"><button className={viewMode === "cards" ? "chip active" : "chip"} type="button" onClick={() => setViewMode("cards")}>כרטיסים</button><button className={viewMode === "compact" ? "chip active" : "chip"} type="button" onClick={() => setViewMode("compact")}>רשימה קומפקטית</button><button className={viewMode === "attention" ? "chip active" : "chip"} type="button" onClick={() => setViewMode("attention")}>דורשים תשומת לב</button></div>
      {rows.length === 0 ? <div className="empty-state"><strong>אין ילדים להצגה</strong><span>הוסיפו ילד דרך קליטה. הכרטיסים יציגו תמונה, נוכחות, בריאות, יומן יומי ואיסוף.</span><Link className="button primary" href="/dashboard/garden/onboarding">קליטת ילד/הורה</Link></div> : <div className="people-card-grid">{rows.map((child) => {
        const childRiskScore = Number(Boolean(child.allergies)) * 30 + Number(child.incident_count ?? 0) * 20 + (child.attendance_status === "not_updated" ? 15 : 0) + (child.pickup_authorized === false ? 35 : 0);
        const risk = riskLevel(childRiskScore);
        const timeline = [
          { title: "נוכחות היום", meta: child.attendance_status ?? "טרם עודכן", tone: child.attendance_status === "present" ? "good" as const : "warn" as const },
          { title: "יומן יומי", meta: child.notes_to_parents ? "נשלחה הערה להורים" : "אין הערה חדשה", tone: child.notes_to_parents ? "good" as const : "warn" as const },
          { title: "שינוי אחרון", meta: formatDate(child.updated_at ?? child.created_at), tone: "good" as const }
        ];
        return <article className="person-card child-profile-card" key={child.id}>
        <div className="person-card-top">
          <Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" />
          <div><span className={statusClass(child.status)}>{child.status ?? "פעיל"}</span><h3>{child.full_name}</h3><p>{ageFromBirthDate(child.birth_date)} · {child.class_group ?? child.age_group ?? "קבוצה לא הוגדרה"}</p></div>
        </div>
        <div className="today-profile-summary"><WandSparkles size={16} /><strong>סיכום היום</strong><span>{child.meals_text || "ארוחות טרם עודכנו"} · {child.sleep_summary ?? "שינה טרם"} · {child.mood ?? "מצב רוח טרם"}</span></div>
        <div className="profile-badge-row">
          <span className={statusClass(child.attendance_status)}><CalendarClock size={14} /> {child.attendance_status ?? "נוכחות טרם עודכנה"}</span>
          <span className={child.allergies ? "pill bad" : "pill good"}><HeartPulse size={14} /> {child.allergies ? "אלרגיה" : "בריאות תקינה"}</span>
          <span className={child.pickup_authorized === false ? "pill bad" : "pill good"}><ShieldCheck size={14} /> {child.pickup_status ?? "איסוף מורשה"}</span>
          <span className={child.has_change_clothes === false ? "pill bad" : "pill good"}><Shirt size={14} /> {child.has_change_clothes === false ? "חסר בגדים" : "בגדים להחלפה"}</span>
          <span className={child.open_parent_requests ? "pill warn" : "pill good"}><Bell size={14} /> {child.open_parent_requests ?? 0} בקשות</span>
          <span className={child.payments_paused ? "pill bad" : paymentClass(child.payment_status)}>תשלום {child.payments_paused ? "נעצר" : child.payment_status ?? "לא הוגדר"}</span>
          <span className={risk.className}>{risk.label}</span>
        </div>
        <div className="mini-kpi-row"><span>שינה <b>{child.sleep_summary ?? "טרם"}</b></span><span>מצב רוח <b>{child.mood ?? "טרם"}</b></span><span>תשלום בפועל <b>₪{child.actual_monthly_fee ?? child.monthly_fee ?? 0}</b></span></div>
        <div className="quick-history-cards"><span>איסוף <b>{child.pickup_status ?? "ממתין"}</b></span><span>בריאות <b>{child.allergies ? "רגישויות" : "תקין"}</b></span><span>שינוי <b>{formatDate(child.updated_at ?? child.created_at)}</b></span></div>
        <QuickChildOps childId={child.id} gardenId={child.garden_id} />
        <div className="child-profile-tabs" aria-label="אזורים בכרטיס ילד">
          {["Overview", "Health", "Parents", "Payments", "Daily Journal", "Incidents", "Media", "Documents", "Timeline"].map((tab) => <span key={tab}>{tab}</span>)}
        </div>
        <details className="profile-expand">
          <summary>פתיחת כרטיס מלא</summary>
          <div className="profile-details-grid">
            <section><h4>פרטים אישיים</h4><p>תאריך לידה: {child.birth_date ?? "-"}</p><p>ת״ז: {child.identity_number ?? "-"}</p><p>הורים: {[child.mother_name, child.father_name, child.parent_name].filter(Boolean).join(" / ") || "-"}</p><p>חירום: {child.emergency_phone ?? "-"}</p></section>
            <section><h4>בריאות</h4><p>קופה: {child.hmo ?? "-"}</p><p>אלרגיות: {child.allergies || "אין אלרגיות מתועדות"}</p><p>תרופות: {child.regular_medications || child.medications || "אין תרופות קבועות"}</p><p>סוג דם: {child.blood_type ?? "לא צוין"}</p><p>{child.medical_notes ?? ""}</p></section>
            <section><h4>פעילות היום</h4><p>ארוחות: {child.meals_text ?? "טרם עודכן"}</p><p>שינה: {child.sleep_summary ?? "טרם עודכן"}</p><p>מצב רוח: {child.mood ?? "טרם עודכן"}</p><p>הערות: {child.notes_to_parents ?? "אין הערות"}</p></section>
            <section><h4>Payments</h4><p>קבוצת תשלום: {child.fee_group_name ?? "לא הוגדרה"}</p><p>מחיר ברירת מחדל: ₪{child.group_monthly_fee ?? child.monthly_fee ?? 0}</p><p>מחיר בפועל: ₪{child.actual_monthly_fee ?? child.monthly_fee ?? 0}</p><p>הסדר מיוחד: {child.has_special_arrangement ? `פעיל עד ${formatDate(child.arrangement_valid_until)}` : "אין"}</p><p>עצירת תשלומים: {child.payments_paused ? child.paused_reason ?? "כן" : "לא"}</p><p>חוב פתוח: ₪{child.debt_amount ?? 0}</p><p>סטטוס: {child.payment_status ?? "לא הוגדר"}</p><p>שולם לאחרונה: {formatDate(child.last_payment_date)}</p><p>תוקף עד: {formatDate(child.valid_until)}</p><p>יעד הבא: {formatDate(child.next_payment_due)}</p><p>סכום אחרון: ₪{child.last_amount_paid ?? 0}</p><p>הערות: {child.arrangement_notes ?? child.payment_notes ?? "אין"}</p><ChildPaymentActions childId={child.id} amount={Number(child.actual_monthly_fee ?? child.monthly_fee ?? 0)} /></section>
            <section><h4>ציר פעילות</h4><Timeline items={timeline} /></section>
            <section><h4>מדיה</h4><div className="gallery-preview">{(child.photo_urls ?? [child.photo_url]).filter(Boolean).slice(0, 3).map((url: string) => <img src={url} alt="תמונת ילד" key={url} />)}</div></section>
          </div>
        </details>
        <div className="profile-actions"><Link className="button secondary tiny" href={`/dashboard/garden/children/${child.id}`}>פתיחת פרופיל</Link><Link className="button secondary tiny" href={`/dashboard/garden/messages?compose=1&childId=${child.id}#message-workbench`}><MessageCircle size={14} /> הודעה להורה</Link><Link className="button secondary tiny" href="/dashboard/garden/incidents?new=1#incident-workbench"><AlertTriangle size={14} /> אירוע</Link><Link className="button secondary tiny" href={`/dashboard/garden/children/${child.id}/timeline`}>הערה</Link><button className="button tiny" type="button" onClick={() => window.print()}><Printer size={14} /> הדפסה</button></div>
      </article>; })}</div>}
    </section>
  );
}

export function ParentProfileCards({ parents }: { parents: Row[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const rows = useMemo(() => parents.filter((parent) => {
    const text = `${parent.full_name} ${parent.phone} ${parent.email} ${(parent.children ?? []).map((child: Row) => child.full_name).join(" ")}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!filter || parent.status === filter);
  }).sort((a, b) => sort === "name" ? String(a.full_name).localeCompare(String(b.full_name), "he") : new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()), [parents, query, filter, sort]);
  const filters = Array.from(new Set(parents.map((parent) => parent.status).filter(Boolean)));

  return (
    <section className="dashboard-section people-directory">
      <div className="section-heading"><h2>כרטיסי הורים וקשר משפחתי</h2><p>ילדים משויכים, הרשאות איסוף, הודעות, תלונות ומסמכי הורה במקום אחד.</p></div>
      <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} filterOptions={filters} />
      {rows.length === 0 ? <div className="empty-state"><strong>אין הורים להצגה</strong><span>הוסיפו הורה דרך תהליך הקליטה כדי לפתוח משתמש ולהתחיל רישום ילד.</span><Link className="button primary" href="/dashboard/garden/onboarding">הוספת הורה</Link></div> : <div className="people-card-grid">{rows.map((parent) => {
        const parentRisk = riskLevel(Number(parent.complaint_count ?? 0) * 30 + Number(parent.unread_messages ?? 0) * 10 + (parent.pickup_allowed === false ? 45 : 0));
        const credential = Array.isArray(parent.generated_credentials) ? parent.generated_credentials[0] : null;
        const passwordChanged = Boolean(credential?.password_changed_at);
        return <article className="person-card parent-profile-card" key={parent.id}>
        <div className="person-card-top"><Avatar name={parent.full_name} src={parent.profile_image_url} size="lg" /><div><span className={statusClass(parent.status)}>{parent.status ?? "active"}</span><h3>{parent.full_name}</h3><p>{parent.phone ?? "-"} · {parent.email ?? "אין מייל"}</p></div></div>
        <div className="today-profile-summary"><WandSparkles size={16} /><strong>קשר משפחתי</strong><span>{(parent.children ?? []).map((child: Row) => child.full_name).join(", ") || "אין ילדים משויכים"} · {parent.emergency_status ?? "סטטוס חירום תקין"}</span></div>
        <div className="profile-badge-row"><span className="pill good"><Baby size={14} /> {(parent.children ?? []).length} ילדים</span><span className={parent.pickup_allowed === false ? "pill bad" : "pill good"}><ShieldCheck size={14} /> איסוף</span><span className={parent.unread_messages ? "pill warn" : "pill good"}><Bell size={14} /> {parent.unread_messages ?? 0} הודעות</span><span className={parentRisk.className}>{parentRisk.label}</span></div>
        <div className="linked-children-strip">{(parent.children ?? []).slice(0, 4).map((child: Row) => <span key={child.id}><Avatar name={child.full_name} src={child.photo_url} size="sm" /> {child.full_name}</span>)}</div>
        <div className="quick-history-cards"><span>מסמכים <b>{parent.document_count ?? 0}</b></span><span>פניות <b>{parent.complaint_count ?? 0}</b></span><span>קשר אחרון <b>{formatDate(parent.last_interaction_at ?? parent.created_at)}</b></span></div>
        <div className="credential-box compact" dir="ltr"><b>{credential?.username ?? parent.email ?? "No username"}</b>{credential && !passwordChanged ? <code>{credential.temporary_password}</code> : <span dir="rtl">הסיסמה הוחלפה על ידי ההורה</span>}</div>
        <details className="profile-expand"><summary>פרטים, הרשאות והיסטוריית קשר</summary><div className="profile-details-grid"><section><h4>כל הילדים</h4>{(parent.children ?? []).map((child: Row) => <p key={child.id}>{child.full_name} · {child.status}</p>)}</section><section><h4>הרשאות וטפסים</h4><p>מורשה איסוף: {parent.pickup_allowed === false ? "דורש בדיקה" : "כן"}</p><p>מסמכים: {parent.document_count ?? 0}</p><p>חירום: {parent.emergency_status ?? "תקין"}</p></section><section><h4>פניות וקשר</h4><p>תלונות פתוחות: {parent.complaint_count ?? 0}</p><p>אינטראקציה אחרונה: {parent.last_interaction_at ? new Date(parent.last_interaction_at).toLocaleString("he-IL") : "אין"}</p></section><section><h4>Timeline</h4><Timeline items={[{ title: "נוצר קשר", meta: formatDate(parent.last_interaction_at ?? parent.created_at), tone: "good" }, { title: "הודעות פתוחות", meta: `${parent.unread_messages ?? 0}`, tone: parent.unread_messages ? "warn" : "good" }, { title: "מסמכים", meta: `${parent.document_count ?? 0} מסמכים`, tone: "good" }]} /></section></div></details>
        <div className="profile-actions"><Link className="button secondary tiny" href="/dashboard/garden/messages"><MessageCircle size={14} /> הודעה</Link>{parent.phone ? <a className="button secondary tiny" href={`tel:${parent.phone}`}><Phone size={14} /> שיחה</a> : <button className="button secondary tiny" type="button" disabled title="לא הוגדר מספר טלפון להורה"><Phone size={14} /> אין מספר טלפון</button>}{credential && !passwordChanged ? <button className="button secondary tiny" type="button" onClick={() => navigator.clipboard?.writeText(`${credential.username}\n${credential.temporary_password}`)}>העתקת כניסה</button> : <button className="button secondary tiny" type="button" disabled title="איפוס סיסמה יתבצע דרך ניהול משתמשים באדמין או מסך אבטחה ייעודי">איפוס סיסמה לא זמין כאן</button>}<Link className="button tiny" href={`/dashboard/garden/parents?parent=${parent.id}`}>פרופיל</Link></div>
      </article>; })}</div>}
    </section>
  );
}

export function StaffProfileCards({ staff }: { staff: Row[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("risk");
  const rows = useMemo(() => staff.filter((member) => {
    const text = `${member.full_name} ${member.role_title} ${member.class_group} ${member.background_check_status} ${member.police_clearance_status}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!filter || member.approval_status === filter || member.role_title === filter);
  }).sort((a, b) => {
    if (sort === "risk") return Number(b.missing_documents ?? 0) + Number(!b.approved_to_work) - (Number(a.missing_documents ?? 0) + Number(!a.approved_to_work));
    return String(a.full_name).localeCompare(String(b.full_name), "he");
  }), [staff, query, filter, sort]);
  const filters = Array.from(new Set(staff.flatMap((member) => [member.approval_status, member.role_title]).filter(Boolean)));

  return (
    <section className="dashboard-section people-directory">
      <div className="section-heading"><h2>כרטיסי צוות וציות</h2><p>אישורי עבודה, תעודות, משמרות, משימות, נוכחות ובדיקות רקע בתצוגת פרופיל.</p></div>
      <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} filterOptions={filters} />
      {rows.length === 0 ? <div className="empty-state"><strong>אין אנשי צוות להצגה</strong><span>הוסיפו איש צוות דרך קליטה. עובד לא מוצג כפעיל בלי מסמכי חובה.</span><Link className="button primary" href="/dashboard/garden/onboarding">הוספת צוות</Link></div> : <div className="people-card-grid">{rows.map((member) => {
        const staffRisk = riskLevel(100 - Number(member.compliance_score ?? 0));
        return <article className="person-card staff-profile-card" key={member.id}>
        <div className="person-card-top"><Avatar name={member.full_name} src={member.profile_photo_url ?? member.profile_image_url} size="lg" /><div><span className={member.approved_to_work ? "pill good" : "pill bad"}>{member.approved_to_work ? "מאושר/ת" : "לא מאושר/ת"}</span><h3>{member.full_name}</h3><p>{member.role_title ?? "צוות"} · {member.class_group ?? "כיתה לא הוגדרה"}</p></div></div>
        <div className="today-profile-summary"><WandSparkles size={16} /><strong>סיכום צוות</strong><span>{member.shift_today ?? "אין משמרת היום"} · {member.task_count ?? 0} משימות · {member.missing_documents ?? 0} מסמכים חסרים</span></div>
        <div className="profile-badge-row"><span className={statusClass(member.background_check_status)}><ShieldCheck size={14} /> רקע {member.background_check_status ?? "missing"}</span><span className={statusClass(member.police_clearance_status)}><FileText size={14} /> יושר {member.police_clearance_status ?? "missing"}</span><span className={member.shift_today ? "pill good" : "pill warn"}><CalendarClock size={14} /> {member.shift_today ?? "אין משמרת"}</span><span className={staffRisk.className}>{staffRisk.label}</span></div>
        <div className="mini-kpi-row"><span>ציות <b>{member.compliance_score ?? 0}%</b></span><span>משימות <b>{member.task_count ?? 0}</b></span><span>מסמכים חסרים <b>{member.missing_documents ?? 0}</b></span></div>
        <div className="quick-history-cards"><span>אישור מנהלת <b>{formatDate(member.manager_approved_at)}</b></span><span>בדיקת פקח <b>{formatDate(member.inspector_verified_at)}</b></span><span>תחילת עבודה <b>{formatDate(member.created_at)}</b></span></div>
        <details className="profile-expand"><summary>תעודות, משימות ונוכחות</summary><div className="profile-details-grid"><section><h4>תעודות</h4><p>בדיקת רקע: {member.background_check_status ?? "-"}</p><p>אישור יושר: {member.police_clearance_status ?? "-"}</p><p>תעודות נוספות: {member.certificate_count ?? 0}</p></section><section><h4>משימות ונוכחות</h4><p>משימות פתוחות: {member.task_count ?? 0}</p><p>משמרת היום: {member.shift_today ?? "לא הוגדרה"}</p><p>שעות חודשיות: {member.monthly_hours ?? "טרם חושב"}</p></section><section><h4>פיקוח</h4><p>בדיקת פקח: {member.inspector_verified_at ? new Date(member.inspector_verified_at).toLocaleDateString("he-IL") : "טרם"}</p><p>אישור מנהלת: {member.manager_approved_at ? new Date(member.manager_approved_at).toLocaleDateString("he-IL") : "טרם"}</p></section><section><h4>Timeline</h4><Timeline items={[{ title: "סטטוס עבודה", meta: member.approved_to_work ? "מאושר/ת לעבודה" : "ממתין/ה לאישור", tone: member.approved_to_work ? "good" : "bad" }, { title: "מסמכים", meta: `${member.missing_documents ?? 0} חסרים`, tone: member.missing_documents ? "warn" : "good" }, { title: "ציות", meta: `${member.compliance_score ?? 0}%`, tone: Number(member.compliance_score ?? 0) >= 80 ? "good" : "warn" }]} /></section></div></details>
        <div className="profile-actions"><Link className="button secondary tiny" href="/dashboard/garden/tasks"><UserCheck size={14} /> משימה</Link><Link className="button secondary tiny" href="/dashboard/garden/messages"><MessageCircle size={14} /> הודעה</Link><Link className="button secondary tiny" href="/dashboard/garden/documents"><FileText size={14} /> מסמכים</Link><Link className="button tiny" href={`/dashboard/garden/staff?staff=${member.id}`}>פרופיל</Link></div>
      </article>; })}</div>}
    </section>
  );
}
