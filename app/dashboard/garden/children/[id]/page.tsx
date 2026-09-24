import Link from "next/link";
import { AlertTriangle, Baby, CalendarDays, Camera, CheckCircle2, Clock3, CreditCard, FileText, HeartPulse, History, MessageCircle, MoreHorizontal, Phone, ShieldCheck, UserRound, UsersRound, WalletCards } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ChildOperationsPanel } from "@/components/child-operations-panel";
import { ChildPhotoUpload } from "@/components/child-photo-upload";
import { ChildProfileEditForm } from "@/components/child-profile-edit-form";
import { ClassroomAssignmentForm } from "@/components/classroom-management-actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { TeacherAppFrame, TeacherEmptyState } from "@/components/teacher-app-ui";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type Tab = "overview" | "attendance" | "guardians" | "pickup" | "documents" | "tuition" | "communication" | "history";
const tabs: Array<{ key: Tab; label: string; icon: typeof Baby }> = [
  { key: "overview", label: "סקירה", icon: Baby }, { key: "attendance", label: "נוכחות", icon: CalendarDays },
  { key: "guardians", label: "הורים ואפוטרופוסים", icon: UsersRound }, { key: "pickup", label: "מורשי איסוף", icon: ShieldCheck },
  { key: "documents", label: "מסמכים", icon: FileText }, { key: "tuition", label: "שכר לימוד", icon: WalletCards },
  { key: "communication", label: "תקשורת", icon: MessageCircle }, { key: "history", label: "היסטוריה", icon: History }
];

function dateText(value?: string | null, includeTime = false) {
  if (!value) return "—";
  return includeTime ? new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : new Date(value).toLocaleDateString("he-IL");
}

function ageText(value?: string | null) {
  if (!value) return "גיל לא צוין";
  const months = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 2_629_800_000));
  return months >= 12 ? `${Math.floor(months / 12)}.${months % 12} שנים` : `${months} חודשים`;
}

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = { active: "פעיל", approved: "מאושר", pending: "ממתין", verified: "מאומת", rejected: "נדחה", expired: "פג תוקף", uploaded: "הועלה", partially_paid: "שולם חלקית", paid: "שולם", overdue: "באיחור", reconciliation_required: "נדרשת התאמה", present: "נוכח/ת", absent: "נעדר/ת", departed: "נאסף/ה", checked_out: "נאסף/ה" };
  return labels[String(value)] ?? String(value || "לא הוגדר");
}

function statusTone(value?: string | null): "success" | "warning" | "danger" | "info" | "muted" {
  if (["active", "approved", "verified", "paid", "present"].includes(String(value))) return "success";
  if (["rejected", "expired", "overdue", "reconciliation_required"].includes(String(value))) return "danger";
  if (["pending", "uploaded", "partially_paid", "absent"].includes(String(value))) return "warning";
  return "muted";
}

export default async function GardenChildProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; edit?: string }> }) {
  const access = await getManagementGardenContext();
  if (!access.allowed) notFound();
  const { profile } = access.session;
  const { id } = await params;
  const query = await searchParams;
  const tab = tabs.some((item) => item.key === query.tab) ? query.tab as Tab : "overview";
  const supabase = await createClient();
  const gardenId = access.gardenId;
  const childRes = await supabase.from("children" as never).select("*" as never).eq("id", id).eq("garden_id", gardenId).maybeSingle();
  const child = childRes.data as unknown as Record<string, unknown> | null;
  if (!child) {
    return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="כרטיס ילד" appHome><TeacherAppFrame role={profile.role === "owner" ? "owner" : "manager"} title="כרטיס ילד" subtitle="לא נמצא" avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url ?? null} active="children"><TeacherEmptyState title="כרטיס הילד לא נמצא" text="ייתכן שהילד אינו שייך לגן הפעיל." action={<Link className="button primary" href="/dashboard/garden/children">חזרה לילדים</Link>} /></TeacherAppFrame></DashboardShell>;
  }

  const childFileId = typeof child.permanent_child_file_id === "string" ? child.permanent_child_file_id : null;
  const [attendanceRes, guardiansRes, pickupContactsRes, pickupEventsRes, docsRes, tuitionRes, messagesRes, journalsRes, incidentsRes, assignmentsRes, classroomsRes, enrollmentsRes, timelineRes, gardenRes] = await Promise.all([
    supabase.from("attendance" as never).select("id,attendance_date,status,check_in_at,check_out_at,pickup_name,note,updated_at" as never).eq("child_id", id).eq("garden_id", gardenId).order("attendance_date", { ascending: false }).limit(45),
    childFileId ? supabase.from("child_guardian_links" as never).select("id,relationship_type,is_primary,legal_authority,status,valid_from,valid_until,access_scope,profiles:guardian_profile_id(id,full_name,phone,email,profile_image_url)" as never).eq("permanent_child_file_id", childFileId).order("is_primary", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    supabase.from("authorized_pickup_contacts" as never).select("id,full_name,relation,phone,active,authorization_type,valid_from,valid_until,notes" as never).eq("child_id", id).eq("kindergarten_id", gardenId).order("created_at", { ascending: false }),
    supabase.from("child_pickup_events" as never).select("id,pickup_person,authorization_type,pickup_time,status,notes,release_confirmed" as never).eq("child_id", id).eq("kindergarten_id", gardenId).order("pickup_time", { ascending: false }).limit(40),
    supabase.from("documents" as never).select("id,name,document_type,status,expires_at,created_at,verified_at,rejection_reason" as never).eq("child_id", id).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(50),
    supabase.from("tuition_billing_periods" as never).select("id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,status,reconciliation_reason" as never).eq("child_id", id).eq("garden_id", gardenId).order("period_start", { ascending: false }).limit(24),
    supabase.from("messages" as never).select("id,subject,body,content,status,created_at,sender:sender_id(full_name),recipient:recipient_id(full_name)" as never).eq("linked_child_id", id).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(30),
    supabase.from("child_daily_journals" as never).select("id,journal_date,mood,sleep_summary,notes_to_parents" as never).eq("child_id", id).eq("garden_id", gardenId).order("journal_date", { ascending: false }).limit(20),
    supabase.from("incident_reports" as never).select("id,title,severity,status,description,created_at" as never).eq("child_id", id).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(20),
    supabase.from("child_classroom_assignments" as never).select("id,classroom_id,is_current,assigned_at,ended_at,end_reason,classrooms(name,age_group_label)" as never).eq("child_id", id).eq("garden_id", gardenId).order("assigned_at", { ascending: false }),
    supabase.from("classrooms" as never).select("id,name,status" as never).eq("garden_id", gardenId).eq("status", "active").order("sort_order").order("name"),
    childFileId ? supabase.from("child_kindergarten_enrollments" as never).select("id,status,start_date,end_date,classroom_name,notes,gardens(name,city)" as never).eq("permanent_child_file_id", childFileId).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    childFileId ? supabase.from("child_timeline_events" as never).select("id,event_type,title,description,garden_id,created_at,gardens(name)" as never).eq("permanent_child_file_id", childFileId).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    supabase.from("gardens" as never).select("name" as never).eq("id", gardenId).maybeSingle()
  ]);
  const sourceErrors = [childRes.error, attendanceRes.error, guardiansRes.error, pickupContactsRes.error, pickupEventsRes.error, docsRes.error, tuitionRes.error, messagesRes.error, journalsRes.error, incidentsRes.error, assignmentsRes.error, classroomsRes.error, enrollmentsRes.error, timelineRes.error, gardenRes.error].filter(Boolean);
  const attendance = (attendanceRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const guardians = (guardiansRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const pickupContacts = (pickupContactsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const pickupEvents = (pickupEventsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const docs = (docsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const tuition = (tuitionRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const messages = (messagesRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const journals = (journalsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const incidents = (incidentsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const assignments = (assignmentsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const classrooms = (classroomsRes.data ?? []) as unknown as Array<{ id: string; name: string }>;
  const enrollments = (enrollmentsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const timeline = (timelineRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const currentAssignment = assignments.find((item) => item.is_current === true);
  const classroom = currentAssignment?.classrooms as Record<string, unknown> | undefined;
  const latestAttendance = attendance[0];
  const outstanding = tuition.reduce((sum, period) => sum + Math.max(0, Number(period.base_amount ?? 0) + Number(period.adjustment_total ?? 0) - Number(period.settled_total ?? 0)), 0);
  const activeEnrollment = enrollments.find((item) => item.status === "active") ?? enrollments[0];
  const gardenName = String((gardenRes.data as Record<string, unknown> | null)?.name ?? "הגן הפעיל").replace(/\[DEMO\]/g, "").trim();
  const enrichedChild = { ...child, classroom: classroom?.name ?? child.classroom ?? child.age_group, actual_monthly_fee: child.custom_monthly_fee ?? child.monthly_fee, fee_group_name: child.classroom ?? child.age_group };

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="כרטיס ילד" appHome>
      <TeacherAppFrame role={profile.role === "owner" ? "owner" : "manager"} title="כרטיס ילד" subtitle={gardenName} avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url ?? null} active="children">
        <div className="ux04-domain-workspace ux04-child-profile">
          <div className="ux04-profile-breadcrumb"><Link href="/dashboard/garden/children">ילדים</Link><span>›</span><b>{String(child.full_name ?? "כרטיס ילד")}</b></div>
          <section className="ux04-profile-hero">
            <div className="ux04-profile-avatar"><Avatar name={String(child.full_name ?? "ילד/ה")} src={typeof child.photo_url === "string" ? child.photo_url : typeof child.face_image_url === "string" ? child.face_image_url : undefined} size="lg" /><Link href={`/dashboard/garden/children/${id}?edit=photo`} aria-label="עדכון תמונה"><Camera size={18} /></Link></div>
            <div className="ux04-profile-title"><h2>{String(child.full_name ?? "ילד/ה")}</h2><p>{ageText(typeof child.birth_date === "string" ? child.birth_date : null)} · {String(classroom?.name ?? child.classroom ?? child.age_group ?? "ללא כיתה")}</p><div><StatusChip tone={statusTone(String(activeEnrollment?.status ?? child.status))}>{statusLabel(String(activeEnrollment?.status ?? child.status))}</StatusChip><StatusChip tone={latestAttendance?.status === "present" ? "success" : "muted"}>{latestAttendance ? statusLabel(String(latestAttendance.status)) : "אין נוכחות היום"}</StatusChip></div></div>
            <div className="ux04-profile-actions"><Link className="button primary" href={`/dashboard/garden/children/${id}?tab=overview&edit=1`}>עריכת פרופיל</Link><Link className="ux04-more-button" href={`/dashboard/garden/children/${id}?tab=history`} aria-label="היסטוריית הילד"><MoreHorizontal size={20} /></Link></div>
          </section>
          <nav className="ux04-profile-tabs" aria-label="חלקי כרטיס הילד">{tabs.map((item) => { const Icon = item.icon; return <Link className={tab === item.key ? "active" : ""} href={`/dashboard/garden/children/${id}?tab=${item.key}`} key={item.key}><Icon size={17} />{item.label}</Link>; })}</nav>
          {sourceErrors.length ? <div className="ux04-source-error"><AlertTriangle size={20} /><span><b>חלק מנתוני הכרטיס אינם זמינים</b><small>המסך אינו מציג אפס במקום מקור נתונים שנכשל.</small></span></div> : null}

          {tab === "overview" ? <section className="ux04-profile-grid">
            {query.edit === "1" ? <article className="ux04-profile-panel wide"><header><h3>עריכת פרטים בסיסיים</h3><Link href={`/dashboard/garden/children/${id}`}>סגירה</Link></header><ChildProfileEditForm child={{ id, full_name: String(child.full_name ?? ""), birth_date: typeof child.birth_date === "string" ? child.birth_date : null, hmo: typeof child.hmo === "string" ? child.hmo : null }} /></article> : null}
            <article className="ux04-profile-panel"><header><h3>נתונים כלליים</h3><Baby size={20} /></header><dl><div><dt>תאריך לידה</dt><dd>{dateText(typeof child.birth_date === "string" ? child.birth_date : null)}</dd></div><div><dt>גיל</dt><dd>{ageText(typeof child.birth_date === "string" ? child.birth_date : null)}</dd></div><div><dt>כיתה</dt><dd>{String(classroom?.name ?? "ללא שיוך")}</dd></div><div><dt>קופת חולים</dt><dd>{String(child.hmo ?? "לא צוין")}</dd></div><div><dt>גן</dt><dd>{gardenName}</dd></div></dl><ClassroomAssignmentForm childId={id} classrooms={classrooms} currentClassroomId={typeof currentAssignment?.classroom_id === "string" ? currentAssignment.classroom_id : null} /></article>
            <article className="ux04-profile-panel"><header><h3>פרטי קשר</h3><UsersRound size={20} /></header>{guardians.length ? guardians.slice(0, 3).map((link) => { const guardian = link.profiles as Record<string, unknown> | undefined; return <div className="ux04-contact-row" key={String(link.id)}><Avatar name={String(guardian?.full_name ?? "אפוטרופוס")} src={typeof guardian?.profile_image_url === "string" ? guardian.profile_image_url : undefined} size="sm" /><span><b>{String(guardian?.full_name ?? "אפוטרופוס")}</b><small>{statusLabel(String(link.relationship_type))} · {link.is_primary ? "איש קשר ראשי" : "איש קשר נוסף"}</small></span>{guardian?.phone ? <a href={`tel:${guardian.phone}`} aria-label="חיוג"><Phone size={18} /></a> : null}</div>; }) : <p className="ux04-empty-copy">אין קישור אפוטרופוס פעיל להצגה.</p>}<Link className="ux04-panel-link" href={`/dashboard/garden/children/${id}?tab=guardians`}>לכל ההורים והאפוטרופוסים</Link></article>
            <article className="ux04-profile-panel"><header><h3>רגישויות ומידע רפואי</h3><HeartPulse size={20} /></header><dl><div><dt>אלרגיות</dt><dd>{String(child.allergies ?? "לא דווחו")}</dd></div><div><dt>רגישויות</dt><dd>{String(child.sensitivities ?? "לא דווחו")}</dd></div><div><dt>תרופות קבועות</dt><dd>{String(child.regular_medications ?? "לא דווחו")}</dd></div><div><dt>הערות רפואיות</dt><dd>{String(child.medical_notes ?? "אין הערות")}</dd></div></dl></article>
            <article className="ux04-profile-panel"><header><h3>נוכחות החודש</h3><CalendarDays size={20} /></header><div className="ux04-week-dots">{attendance.slice(0, 7).reverse().map((row) => <span className={row.status === "present" ? "present" : row.status === "absent" ? "absent" : "muted"} title={dateText(String(row.attendance_date))} key={String(row.id)} />)}</div><strong className="ux04-attendance-score">{attendance.filter((row) => row.status === "present").length}/{attendance.length || 0}</strong><small>רשומות נוכחות זמינות</small><Link className="ux04-panel-link" href={`/dashboard/garden/children/${id}?tab=attendance`}>מעבר לנוכחות מלאה</Link></article>
            <article className="ux04-profile-panel wide"><header><h3>פעולות תפעוליות</h3><CheckCircle2 size={20} /></header><ChildOperationsPanel child={enrichedChild} gardenId={gardenId} /></article>
            {query.edit === "photo" ? <article className="ux04-profile-panel wide"><header><h3>תמונת פרופיל</h3><Camera size={20} /></header><ChildPhotoUpload childId={id} initialUrl={typeof child.photo_url === "string" ? child.photo_url : typeof child.face_image_url === "string" ? child.face_image_url : null} /></article> : null}
          </section> : null}

          {tab === "attendance" ? <DomainList title="נוכחות" empty="אין רשומות נוכחות להצגה.">{attendance.map((row) => <article className="ux04-domain-row" key={String(row.id)}><span className="ux04-row-icon"><CalendarDays size={20} /></span><div><b>{dateText(String(row.attendance_date))}</b><small>כניסה {row.check_in_at ? dateText(String(row.check_in_at), true) : "לא נרשמה"} · יציאה {row.check_out_at ? dateText(String(row.check_out_at), true) : "טרם נרשמה"}</small></div><StatusChip tone={statusTone(String(row.status))}>{statusLabel(String(row.status))}</StatusChip></article>)}</DomainList> : null}
          {tab === "guardians" ? <DomainList title="הורים ואפוטרופוסים" empty="אין אפוטרופוסים מקושרים להצגה.">{guardians.map((link) => { const guardian = link.profiles as Record<string, unknown> | undefined; return <article className="ux04-domain-row" key={String(link.id)}><Avatar name={String(guardian?.full_name ?? "אפוטרופוס")} src={typeof guardian?.profile_image_url === "string" ? guardian.profile_image_url : undefined} size="sm" /><div><b>{String(guardian?.full_name ?? "אפוטרופוס")}</b><small>{statusLabel(String(link.relationship_type))} · {String(guardian?.phone ?? guardian?.email ?? "אין פרטי קשר")}</small></div><StatusChip tone={statusTone(String(link.status))}>{link.is_primary ? "ראשי · " : ""}{statusLabel(String(link.status))}</StatusChip></article>; })}</DomainList> : null}
          {tab === "pickup" ? <><DomainList title="מורשי איסוף" empty="לא הוגדרו מורשי איסוף.">{pickupContacts.map((contact) => <article className="ux04-domain-row" key={String(contact.id)}><span className="ux04-row-icon"><ShieldCheck size={20} /></span><div><b>{String(contact.full_name)}</b><small>{String(contact.relation)} · {String(contact.phone ?? "אין טלפון")} · {contact.valid_until ? `בתוקף עד ${dateText(String(contact.valid_until))}` : "ללא תאריך סיום"}</small></div><StatusChip tone={contact.active ? "success" : "danger"}>{contact.active ? "מורשה" : "בוטל"}</StatusChip></article>)}</DomainList><DomainList title="היסטוריית איסוף ושחרור" empty="אין אירועי איסוף להצגה.">{pickupEvents.map((event) => <article className="ux04-domain-row" key={String(event.id)}><span className="ux04-row-icon"><Clock3 size={20} /></span><div><b>{String(event.pickup_person)}</b><small>{dateText(String(event.pickup_time), true)} · {String(event.authorization_type)}</small></div><StatusChip tone={event.release_confirmed ? "success" : "warning"}>{event.release_confirmed ? "שוחרר באישור צוות" : statusLabel(String(event.status))}</StatusChip></article>)}</DomainList><p className="ux04-policy-note"><ShieldCheck size={18} /> צילום או התאמת פנים אינם סמכות שחרור. צוות מורשה מאשר את האיסוף.</p></> : null}
          {tab === "documents" ? <DomainList title="מסמכי הילד" empty="אין מסמכי ילד להצגה.">{docs.map((doc) => <article className="ux04-domain-row" key={String(doc.id)}><span className="ux04-row-icon"><FileText size={20} /></span><div><b>{String(doc.name ?? doc.document_type ?? "מסמך")}</b><small>הועלה {dateText(String(doc.created_at))}{doc.expires_at ? ` · תוקף עד ${dateText(String(doc.expires_at))}` : ""}</small></div><StatusChip tone={statusTone(String(doc.status))}>{statusLabel(String(doc.status))}</StatusChip></article>)}</DomainList> : null}
          {tab === "tuition" ? <><section className="ux04-tuition-summary"><span><small>יתרה פתוחה</small><b>₪{outstanding.toLocaleString("he-IL")}</b></span><span><small>תקופות חיוב</small><b>{tuition.length}</b></span><span><small>סטטוס אחרון</small><b>{statusLabel(String(tuition[0]?.status ?? "לא קיים"))}</b></span></section><DomainList title="שכר לימוד הורים → גן" empty="אין תקופות חיוב לילד/ה.">{tuition.map((period) => { const amount = Number(period.base_amount ?? 0) + Number(period.adjustment_total ?? 0); const settled = Number(period.settled_total ?? 0); return <article className="ux04-domain-row" key={String(period.id)}><span className="ux04-row-icon"><CreditCard size={20} /></span><div><b>{dateText(String(period.period_start))} — {dateText(String(period.period_end))}</b><small>₪{settled.toLocaleString("he-IL")} מתוך ₪{amount.toLocaleString("he-IL")} · מועד {dateText(String(period.due_at))}</small></div><StatusChip tone={statusTone(String(period.status))}>{statusLabel(String(period.status))}</StatusChip></article>; })}</DomainList><p className="ux04-policy-note"><WalletCards size={18} /> שכר לימוד זה נפרד ממנוי הגן לפלטפורמת גן בטוח.</p></> : null}
          {tab === "communication" ? <><header className="ux04-tab-action"><div><h3>תקשורת בהקשר הילד/ה</h3><p>שיחה מאובטחת נשארת במערכת ההודעות הקנונית.</p></div><Link className="button primary" href={`/dashboard/garden/messages?childId=${id}&compose=1`}>שליחת הודעה</Link></header><DomainList title="הודעות אחרונות" empty="אין הודעות מקושרות לילד/ה.">{messages.map((message) => { const sender = message.sender as Record<string, unknown> | undefined; return <article className="ux04-domain-row" key={String(message.id)}><span className="ux04-row-icon"><MessageCircle size={20} /></span><div><b>{String(message.subject ?? sender?.full_name ?? "הודעה")}</b><small>{String(message.body ?? message.content ?? "").slice(0, 120)} · {dateText(String(message.created_at), true)}</small></div><StatusChip tone={message.status === "read" ? "muted" : "info"}>{statusLabel(String(message.status))}</StatusChip></article>; })}</DomainList></> : null}
          {tab === "history" ? <><DomainList title="היסטוריית שיוך לכיתות" empty="אין היסטוריית כיתות נוספת.">{assignments.map((assignment) => { const room = assignment.classrooms as Record<string, unknown> | undefined; return <article className="ux04-domain-row" key={String(assignment.id)}><span className="ux04-row-icon"><UserRound size={20} /></span><div><b>{String(room?.name ?? "כיתה")}</b><small>מ־{dateText(String(assignment.assigned_at))}{assignment.ended_at ? ` עד ${dateText(String(assignment.ended_at))}` : " · שיוך נוכחי"}</small></div><StatusChip tone={assignment.is_current ? "success" : "muted"}>{assignment.is_current ? "נוכחי" : "הסתיים"}</StatusChip></article>; })}</DomainList><DomainList title="היסטוריית רישום וגנים" empty="אין היסטוריית רישום נוספת.">{enrollments.map((enrollment) => { const garden = enrollment.gardens as Record<string, unknown> | undefined; return <article className="ux04-domain-row" key={String(enrollment.id)}><span className="ux04-row-icon"><Baby size={20} /></span><div><b>{String(garden?.name ?? "גן ילדים")}</b><small>{dateText(String(enrollment.start_date))} — {dateText(typeof enrollment.end_date === "string" ? enrollment.end_date : null)} · {String(enrollment.classroom_name ?? "ללא כיתה")}</small></div><StatusChip tone={statusTone(String(enrollment.status))}>{statusLabel(String(enrollment.status))}</StatusChip></article>; })}</DomainList><DomainList title="ציר זמן" empty="אין אירועי ציר זמן להצגה.">{timeline.map((event) => <article className="ux04-domain-row" key={String(event.id)}><span className="ux04-row-icon"><History size={20} /></span><div><b>{String(event.title ?? event.event_type)}</b><small>{String(event.description ?? "")} · {dateText(String(event.created_at), true)}</small></div></article>)}</DomainList><DomainList title="יומן ואירועים" empty="אין עדכוני יומן או אירועים.">{([...journals.map((row) => ({ ...row, kind: "journal" })), ...incidents.map((row) => ({ ...row, kind: "incident" }))] as Array<Record<string, unknown>>).map((row) => <article className="ux04-domain-row" key={`${row.kind}-${row.id}`}><span className="ux04-row-icon">{row.kind === "journal" ? <CalendarDays size={20} /> : <AlertTriangle size={20} />}</span><div><b>{String(row.kind === "journal" ? row.mood ?? "יומן יומי" : row.title ?? "אירוע")}</b><small>{String(row.kind === "journal" ? row.notes_to_parents ?? row.sleep_summary ?? "" : row.description ?? "")} · {dateText(String(row.journal_date ?? row.created_at))}</small></div>{row.status ? <StatusChip tone={statusTone(String(row.status))}>{statusLabel(String(row.status))}</StatusChip> : null}</article>)}</DomainList></> : null}
        </div>
      </TeacherAppFrame>
    </DashboardShell>
  );
}

function DomainList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return <section className="ux04-domain-list"><header><h3>{title}</h3><span>{count} רשומות</span></header>{count ? <div>{children}</div> : <p className="ux04-empty-copy">{empty}</p>}</section>;
}
