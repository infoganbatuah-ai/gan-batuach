import Link from "next/link";
import {
  AlertTriangle,
  Baby,
  CalendarDays,
  Camera,
  CheckCircle2,
  CreditCard,
  FileText,
  HeartPulse,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserRound,
  WalletCards
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ChildOperationsPanel } from "@/components/child-operations-panel";
import { ChildPhotoUpload } from "@/components/child-photo-upload";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentRequestActions } from "@/components/parent-request-actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

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
    return (
      <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="כרטיס ילד" appHome>
        <TeacherAppFrame title="כרטיס ילד" subtitle="לא נמצא" avatarUrl={(profile as any).profile_image_url ?? null} active="children">
          <TeacherEmptyState title="לא נמצא כרטיס ילד" text="ייתכן שהילד לא שייך לגן שלך או שהכרטיס נמחק." action={<Link className="button primary" href="/dashboard/garden/children">חזרה לילדים</Link>} />
        </TeacherAppFrame>
      </DashboardShell>
    );
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
  const docs = (docsRes.data ?? []) as any[];
  const messages = (messagesRes.data ?? []) as any[];
  const latestJournal = journals[0] as any;
  const latestPayment = payments[0] as any;
  const latestDocument = docs[0] as any;
  const [enrollmentsRes, timelineRes] = child.permanent_child_file_id ? await Promise.all([
    supabase.from("child_kindergarten_enrollments" as any).select("id, garden_id, status, start_date, end_date, classroom_name, notes, gardens(name, city)").eq("permanent_child_file_id", child.permanent_child_file_id).order("created_at", { ascending: false }),
    supabase.from("child_timeline_events" as any).select("id, event_type, title, description, garden_id, created_at, gardens(name)").eq("permanent_child_file_id", child.permanent_child_file_id).order("created_at", { ascending: false }).limit(20)
  ]) : [{ data: [] }, { data: [] }] as any;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="כרטיס ילד" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="כרטיס ילד מלא" avatarUrl={(profile as any).profile_image_url ?? null} active="children">
        <TeacherPageTitle icon={Baby} title="כרטיס ילד מלא" subtitle={`ילדי הקבוצה › ${child.full_name}`} action={<Link className="button secondary" href="/dashboard/garden/children">חזרה לילדים</Link>} />

        <section className="teacher-child-profile-hero">
          <div className="teacher-child-portrait">
            <Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" />
            <Link href={`/dashboard/garden/children/${child.id}?edit=photo`}><Camera size={20} /></Link>
          </div>
          <div>
            <h2>{child.full_name}</h2>
            <p>{age(child.birth_date)} · {child.classroom ?? child.age_group ?? "קבוצה לא הוגדרה"}</p>
            <div className="profile-badge-row">
              <span className={child.status === "active" || child.status === "approved" ? "pill good" : "pill warn"}><CheckCircle2 size={14} /> {child.status ?? "פעיל"}</span>
              <span className={child.allergies ? "pill warn" : "pill good"}><HeartPulse size={14} /> {child.allergies ? "בריאות" : "בריא/ה"}</span>
            </div>
          </div>
          <div className="teacher-child-status-strip">
            <span><ShieldCheck size={24} /><b>מצב בטיחות</b><em>{incidents.length ? "דורש מעקב" : "ללא אירועים פתוחים"}</em></span>
            <span><CalendarDays size={24} /><b>יומן אחרון</b><em>{latestJournal?.journal_date ? dateText(latestJournal.journal_date) : "אין עדכון היום"}</em></span>
            <span><Baby size={24} /><b>איסוף</b><em>{child.pickup_status ?? child.pickup_notes ?? "לא הוגדר"}</em></span>
          </div>
        </section>

        <TeacherStatsGrid>
          <TeacherStatCard title="עדכוני יומן" value={journals.length} hint="רשומות אחרונות" icon={CheckCircle2} tone="purple" />
          <TeacherStatCard title="אירועים פתוחים" value={incidents.length} hint="דורש מעקב" icon={CalendarDays} tone={incidents.length ? "orange" : "green"} />
          <TeacherStatCard title="מסמכים" value={docs.length} hint={latestDocument ? latestDocument.status ?? "קיים" : "אין מסמכים"} icon={AlertTriangle} tone={docs.length ? "green" : "orange"} />
          <TeacherStatCard title="יתרה" value={`₪${Number(child.debt_amount ?? 0).toLocaleString("he-IL")}`} hint="תשלומים" icon={WalletCards} tone={Number(child.debt_amount ?? 0) ? "orange" : "green"} />
        </TeacherStatsGrid>

        <section className="teacher-dashboard-grid">
          <TeacherSection title="רגישויות ומידע רפואי">
            <TeacherCompactList>
              <TeacherCompactItem title="רגישות למזון" subtitle={child.allergies || "אין"} tone={child.allergies ? "orange" : "green"} meta="בריאות" />
              <TeacherCompactItem title="תרופות קבועות" subtitle={child.regular_medications || "אין"} tone="green" meta="רפואי" />
              <TeacherCompactItem title="הערות רפואיות" subtitle={child.medical_notes || "אין הערות"} tone="blue" meta="מעקב" />
            </TeacherCompactList>
          </TeacherSection>

          <TeacherSection title="הורים ואנשי קשר">
            <TeacherCompactList>
              <TeacherCompactItem title={child.mother_name ?? "אמא"} subtitle={child.mother_phone ?? child.emergency_phone ?? "-"} tone="purple" meta={<Phone size={16} />} />
              <TeacherCompactItem title={child.father_name ?? "אבא"} subtitle={child.father_phone ?? "-"} tone="blue" meta={<Phone size={16} />} />
              <TeacherCompactItem title="איש קשר חירום" subtitle={child.emergency_contact_name ?? child.emergency_phone ?? "לא הוגדר"} tone="green" meta={<UserRound size={16} />} />
            </TeacherCompactList>
          </TeacherSection>

          <TeacherSection title="מסמכים ואישורים">
            {docs.length ? (
              <TeacherCompactList>
                {docs.slice(0, 3).map((doc: any) => (
                  <TeacherCompactItem
                    key={doc.id}
                    title={doc.name ?? doc.document_type ?? "מסמך ילד"}
                    subtitle={doc.created_at ? `עודכן: ${dateText(doc.created_at)}` : "קיים במערכת"}
                    tone={["approved", "valid"].includes(String(doc.status)) ? "green" : "orange"}
                    meta={<FileText size={16} />}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="אין מסמכי ילד להצגה" text="מסמכים שהועלו בהרשאה מתאימה יופיעו כאן." />
            )}
          </TeacherSection>

          <TeacherSection title="תשלומים">
            <TeacherCompactList>
              <TeacherCompactItem title="יתרה נוכחית" subtitle="כל התשלומים זוכו" tone={Number(child.debt_amount ?? 0) ? "orange" : "green"} meta={`₪${Number(child.debt_amount ?? 0).toLocaleString("he-IL")}`} />
              <TeacherCompactItem title="קבוצת תשלום" subtitle={enriched.fee_group_name} tone="blue" meta={`₪${enriched.actual_monthly_fee}`} />
              <TeacherCompactItem title="תשלום אחרון" subtitle={latestPayment?.created_at ? dateText(latestPayment.created_at) : `${payments.length} רשומות`} tone="purple" meta={<CreditCard size={16} />} />
            </TeacherCompactList>
          </TeacherSection>
        </section>

        <TeacherQuickActions title="פעולות מהירות">
          <TeacherActionTile title="שליחת הודעה להורים" href={`/dashboard/garden/messages?childId=${child.id}`} icon={MessageCircle} tone="purple" />
          <TeacherActionTile title="עדכון פרטים" href={`/dashboard/garden/children/${child.id}`} icon={FileText} tone="blue" />
          <TeacherActionTile title="דיווח אירוע" href={`/dashboard/garden/incidents?new=1#incident-workbench`} icon={AlertTriangle} tone="red" />
          <TeacherActionTile title="מעבר לכרטיס תשלומים" href="/dashboard/garden/finance" icon={CreditCard} tone="green" />
        </TeacherQuickActions>

        <details className="teacher-management-details">
          <summary>ניהול מלא ופרטים מתקדמים</summary>
          <ChildOperationsPanel child={enriched} gardenId={gardenId} />
          <ChildPhotoUpload childId={child.id} initialUrl={child.photo_url ?? child.face_image_url} />
          <section className="grid cols-2 dashboard-panels">
            <article className="card action-panel"><h2>בקשות הורים</h2>{requests.length === 0 ? <div className="empty-mini">אין בקשות מיוחדות מהורים.</div> : requests.map((request) => <div className="list-item parent-request-item" key={request.id}><div><strong>{request.request_type}</strong><span>{request.content}</span><small>{request.profiles?.full_name ?? request.parents?.full_name ?? "הורה"} · {new Date(request.created_at).toLocaleString("he-IL")} · {request.status}</small><ParentRequestActions childId={child.id} requestId={request.id} /></div></div>)}</article>
            <article className="card action-panel"><h2>אירועים</h2>{incidents.length === 0 ? <div className="empty-mini">אין אירועים פתוחים לילד.</div> : incidents.map((incident) => <div className="list-item" key={incident.id}><div><strong>{incident.title}</strong><span>{incident.description}</span></div><span className={incident.severity === "critical" ? "pill bad" : "pill warn"}>{incident.severity}</span></div>)}</article>
            <article className="card action-panel"><h2>יומן יומי</h2>{journals.length === 0 ? <div className="empty-mini">אין יומנים שמורים.</div> : journals.map((journal) => <div className="list-item" key={journal.id}><div><strong>{dateText(journal.journal_date)}</strong><span>{journal.mood ?? "-"} · {journal.sleep_summary ?? "-"} · {journal.notes_to_parents ?? ""}</span></div></div>)}</article>
            <article className="card action-panel"><h2>מסמכים והודעות</h2>{docs.length === 0 ? <div className="empty-mini">אין מסמכי ילד.</div> : docs.map((doc: any) => <div className="list-item" key={doc.id}><strong>{doc.name ?? doc.document_type}</strong><span className="pill">{doc.status}</span></div>)}<hr />{messages.map((message: any) => <div className="list-item" key={message.id}><strong>{message.sender?.full_name ?? "הודעה"}</strong><span>{message.body ?? message.content ?? ""}</span></div>)}</article>
            <article className="card action-panel"><h2>היסטוריית גנים</h2>{(enrollmentsRes.data ?? []).length === 0 ? <div className="empty-mini">אין היסטוריית שיוכים נוספת.</div> : (enrollmentsRes.data ?? []).map((enrollment: any) => <div className="list-item" key={enrollment.id}><div><strong>{enrollment.gardens?.name ?? "גן ילדים"}</strong><span>{dateText(enrollment.start_date)} - {dateText(enrollment.end_date)} · {enrollment.classroom_name ?? "ללא קבוצה"}</span></div><span className="pill">{enrollment.status}</span></div>)}</article>
            <article className="card action-panel"><h2>ציר זמן תיק ילד</h2>{(timelineRes.data ?? []).length === 0 ? <div className="empty-mini">אין אירועי ציר זמן נוספים.</div> : (timelineRes.data ?? []).map((event: any) => <div className="list-item" key={event.id}><div><strong>{event.title}</strong><span>{event.description ?? ""}</span><small>{event.gardens?.name ?? "מערכת"} · {event.created_at ? new Date(event.created_at).toLocaleString("he-IL") : ""}</small></div></div>)}</article>
          </section>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
