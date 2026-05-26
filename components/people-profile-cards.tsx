"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Baby, Bell, CalendarClock, FileText, HeartPulse, MessageCircle, Phone, Printer, Search, ShieldCheck, UserCheck } from "lucide-react";
import { Avatar } from "@/components/avatar";

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
  const rows = useMemo(() => children.filter((child) => {
    const text = `${child.full_name} ${child.status} ${child.class_group ?? ""} ${child.allergies ?? ""} ${child.hmo ?? ""}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!filter || child.status === filter || child.attendance_status === filter);
  }).sort((a, b) => {
    if (sort === "risk") return Number(Boolean(b.allergies) || b.incident_count || b.attendance_status === "late") - Number(Boolean(a.allergies) || a.incident_count || a.attendance_status === "late");
    if (sort === "recent") return new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    return String(a.full_name).localeCompare(String(b.full_name), "he");
  }), [children, query, filter, sort]);
  const filters = Array.from(new Set(children.flatMap((child) => [child.status, child.attendance_status]).filter(Boolean)));

  return (
    <section className="dashboard-section people-directory">
      <div className="section-heading"><h2>כרטיסי ילדים חכמים</h2><p>בריאות, נוכחות, מצב רוח, איסוף, יומן יומי ותיעוד הורים בכרטיס אחד.</p></div>
      <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} filterOptions={filters} />
      {rows.length === 0 ? <div className="empty-state"><strong>אין ילדים להצגה</strong><span>הוסיפו ילד דרך קליטה. הכרטיסים יציגו תמונה, נוכחות, בריאות, יומן יומי ואיסוף.</span><Link className="button primary" href="/dashboard/garden/onboarding">קליטת ילד/הורה</Link></div> : <div className="people-card-grid">{rows.map((child) => <article className="person-card child-profile-card" key={child.id}>
        <div className="person-card-top">
          <Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" />
          <div><span className={statusClass(child.status)}>{child.status ?? "פעיל"}</span><h3>{child.full_name}</h3><p>{ageFromBirthDate(child.birth_date)} · {child.class_group ?? child.age_group ?? "קבוצה לא הוגדרה"}</p></div>
        </div>
        <div className="profile-badge-row">
          <span className={statusClass(child.attendance_status)}><CalendarClock size={14} /> {child.attendance_status ?? "נוכחות טרם עודכנה"}</span>
          <span className={child.allergies ? "pill bad" : "pill good"}><HeartPulse size={14} /> {child.allergies ? "אלרגיה" : "בריאות תקינה"}</span>
          <span className={child.pickup_authorized === false ? "pill bad" : "pill good"}><ShieldCheck size={14} /> {child.pickup_status ?? "איסוף מורשה"}</span>
        </div>
        <div className="mini-kpi-row"><span>שינה <b>{child.sleep_summary ?? "טרם"}</b></span><span>מצב רוח <b>{child.mood ?? "טרם"}</b></span><span>אירועים <b>{child.incident_count ?? 0}</b></span></div>
        <details className="profile-expand">
          <summary>פתיחת כרטיס מלא</summary>
          <div className="profile-details-grid">
            <section><h4>פרטים אישיים</h4><p>תאריך לידה: {child.birth_date ?? "-"}</p><p>ת״ז: {child.identity_number ?? "-"}</p><p>הורים: {[child.mother_name, child.father_name, child.parent_name].filter(Boolean).join(" / ") || "-"}</p><p>חירום: {child.emergency_phone ?? "-"}</p></section>
            <section><h4>בריאות</h4><p>קופה: {child.hmo ?? "-"}</p><p>אלרגיות: {child.allergies || "אין אלרגיות מתועדות"}</p><p>תרופות: {child.regular_medications || child.medications || "אין תרופות קבועות"}</p><p>סוג דם: {child.blood_type ?? "לא צוין"}</p><p>{child.medical_notes ?? ""}</p></section>
            <section><h4>פעילות היום</h4><p>ארוחות: {child.meals_text ?? "טרם עודכן"}</p><p>שינה: {child.sleep_summary ?? "טרם עודכן"}</p><p>מצב רוח: {child.mood ?? "טרם עודכן"}</p><p>הערות: {child.notes_to_parents ?? "אין הערות"}</p></section>
            <section><h4>מדיה</h4><div className="gallery-preview">{(child.photo_urls ?? [child.photo_url]).filter(Boolean).slice(0, 3).map((url: string) => <img src={url} alt="תמונת ילד" key={url} />)}</div></section>
          </div>
        </details>
        <div className="profile-actions"><Link className="button secondary tiny" href={`/dashboard/garden/children?child=${child.id}`}>פתיחת פרופיל</Link><Link className="button secondary tiny" href="/dashboard/garden/messages"><MessageCircle size={14} /> הודעה להורה</Link><Link className="button secondary tiny" href="/dashboard/garden/incidents"><AlertTriangle size={14} /> אירוע</Link><Link className="button secondary tiny" href="/dashboard/garden/child-journal">הערה</Link><button className="button tiny" type="button" onClick={() => window.print()}><Printer size={14} /> הדפסה</button></div>
      </article>)}</div>}
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
      {rows.length === 0 ? <div className="empty-state"><strong>אין הורים להצגה</strong><span>הוסיפו הורה דרך תהליך הקליטה כדי לפתוח משתמש ולהתחיל רישום ילד.</span><Link className="button primary" href="/dashboard/garden/onboarding">הוספת הורה</Link></div> : <div className="people-card-grid">{rows.map((parent) => <article className="person-card parent-profile-card" key={parent.id}>
        <div className="person-card-top"><Avatar name={parent.full_name} src={parent.profile_image_url} size="lg" /><div><span className={statusClass(parent.status)}>{parent.status ?? "active"}</span><h3>{parent.full_name}</h3><p>{parent.phone ?? "-"} · {parent.email ?? "אין מייל"}</p></div></div>
        <div className="profile-badge-row"><span className="pill good"><Baby size={14} /> {(parent.children ?? []).length} ילדים</span><span className={parent.pickup_allowed === false ? "pill bad" : "pill good"}><ShieldCheck size={14} /> איסוף</span><span className={parent.unread_messages ? "pill warn" : "pill good"}><Bell size={14} /> {parent.unread_messages ?? 0} הודעות</span></div>
        <div className="linked-children-strip">{(parent.children ?? []).slice(0, 4).map((child: Row) => <span key={child.id}><Avatar name={child.full_name} src={child.photo_url} size="sm" /> {child.full_name}</span>)}</div>
        <details className="profile-expand"><summary>פרטים, הרשאות והיסטוריית קשר</summary><div className="profile-details-grid"><section><h4>כל הילדים</h4>{(parent.children ?? []).map((child: Row) => <p key={child.id}>{child.full_name} · {child.status}</p>)}</section><section><h4>הרשאות וטפסים</h4><p>מורשה איסוף: {parent.pickup_allowed === false ? "דורש בדיקה" : "כן"}</p><p>מסמכים: {parent.document_count ?? 0}</p><p>חירום: {parent.emergency_status ?? "תקין"}</p></section><section><h4>פניות וקשר</h4><p>תלונות פתוחות: {parent.complaint_count ?? 0}</p><p>אינטראקציה אחרונה: {parent.last_interaction_at ? new Date(parent.last_interaction_at).toLocaleString("he-IL") : "אין"}</p></section></div></details>
        <div className="profile-actions"><Link className="button secondary tiny" href="/dashboard/garden/messages"><MessageCircle size={14} /> הודעה</Link><a className="button secondary tiny" href={parent.phone ? `tel:${parent.phone}` : undefined}><Phone size={14} /> שיחה</a><Link className="button tiny" href={`/dashboard/garden/parents?parent=${parent.id}`}>פרופיל</Link></div>
      </article>)}</div>}
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
      {rows.length === 0 ? <div className="empty-state"><strong>אין אנשי צוות להצגה</strong><span>הוסיפו איש צוות דרך קליטה. עובד לא מוצג כפעיל בלי מסמכי חובה.</span><Link className="button primary" href="/dashboard/garden/onboarding">הוספת צוות</Link></div> : <div className="people-card-grid">{rows.map((member) => <article className="person-card staff-profile-card" key={member.id}>
        <div className="person-card-top"><Avatar name={member.full_name} src={member.profile_photo_url ?? member.profile_image_url} size="lg" /><div><span className={member.approved_to_work ? "pill good" : "pill bad"}>{member.approved_to_work ? "מאושר/ת" : "לא מאושר/ת"}</span><h3>{member.full_name}</h3><p>{member.role_title ?? "צוות"} · {member.class_group ?? "כיתה לא הוגדרה"}</p></div></div>
        <div className="profile-badge-row"><span className={statusClass(member.background_check_status)}><ShieldCheck size={14} /> רקע {member.background_check_status ?? "missing"}</span><span className={statusClass(member.police_clearance_status)}><FileText size={14} /> יושר {member.police_clearance_status ?? "missing"}</span><span className={member.shift_today ? "pill good" : "pill warn"}><CalendarClock size={14} /> {member.shift_today ?? "אין משמרת"}</span></div>
        <div className="mini-kpi-row"><span>ציות <b>{member.compliance_score ?? 0}%</b></span><span>משימות <b>{member.task_count ?? 0}</b></span><span>מסמכים חסרים <b>{member.missing_documents ?? 0}</b></span></div>
        <details className="profile-expand"><summary>תעודות, משימות ונוכחות</summary><div className="profile-details-grid"><section><h4>תעודות</h4><p>בדיקת רקע: {member.background_check_status ?? "-"}</p><p>אישור יושר: {member.police_clearance_status ?? "-"}</p><p>תעודות נוספות: {member.certificate_count ?? 0}</p></section><section><h4>משימות ונוכחות</h4><p>משימות פתוחות: {member.task_count ?? 0}</p><p>משמרת היום: {member.shift_today ?? "לא הוגדרה"}</p><p>שעות חודשיות: {member.monthly_hours ?? "טרם חושב"}</p></section><section><h4>פיקוח</h4><p>בדיקת פקח: {member.inspector_verified_at ? new Date(member.inspector_verified_at).toLocaleDateString("he-IL") : "טרם"}</p><p>אישור מנהלת: {member.manager_approved_at ? new Date(member.manager_approved_at).toLocaleDateString("he-IL") : "טרם"}</p></section></div></details>
        <div className="profile-actions"><Link className="button secondary tiny" href="/dashboard/garden/tasks"><UserCheck size={14} /> משימה</Link><Link className="button secondary tiny" href="/dashboard/garden/messages"><MessageCircle size={14} /> הודעה</Link><Link className="button secondary tiny" href="/dashboard/garden/documents"><FileText size={14} /> מסמכים</Link><Link className="button tiny" href={`/dashboard/garden/staff?staff=${member.id}`}>פרופיל</Link></div>
      </article>)}</div>}
    </section>
  );
}
