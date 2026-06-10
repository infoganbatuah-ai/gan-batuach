import Link from "next/link";
import { Baby, FileText, HeartPulse, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ChildPhotoUpload } from "@/components/child-photo-upload";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "לא צוין";
}

function age(value?: string | null) {
  if (!value) return "גיל חסר";
  const months = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  return months >= 12 ? `${Math.floor(months / 12)}.${months % 12} שנים` : `${months} חודשים`;
}

function statusLabel(status?: string | null) {
  if (status === "active" || status === "approved") return "מאושר בגן";
  if (status === "pending_parent_completion") return "צריך להשלים פרטים";
  if (status === "rejected") return "נדרש בירור";
  return "ממתין לאישור הגן";
}

export default async function ParentChildProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireRole(["parent"]);
  const { id } = await params;
  const userScopedSupabase = await createClient();
  const supabase = isAdminClientConfigured() ? createAdminClient() : userScopedSupabase;
  const family = await getParentFamilyContext(userScopedSupabase as any, profile);
  const familyChild = (family.children as any[]).find((item) => item.id === id || item.permanent_child_file_id === id);
  const familyEnrollment = (family.enrollments as any[]).find((item) => item.child_id === id || item.permanent_child_file_id === id);
  const childId = familyChild?.id ?? familyEnrollment?.child_id ?? null;
  const childRes = childId ? await supabase.from("children" as any).select("*").eq("id", childId).maybeSingle() : { data: null };
  const child = (childRes.data as any) ?? familyChild ?? (familyEnrollment?.child && familyEnrollment.child.id ? familyEnrollment.child : null);

  if (!child) {
    return (
      <DashboardShell role="parent" title="כרטיס ילד">
        <div className="empty-state"><strong>לא נמצא כרטיס ילד</strong><span>ייתכן שהילד לא משויך למשתמש שלך או שהרישום עדיין לא אושר.</span><Link className="button primary" href="/dashboard/parent">חזרה לאזור הורים</Link></div>
      </DashboardShell>
    );
  }

  const [journalsRes, docsRes, requestsRes] = await Promise.all([
    supabase.from("child_daily_journals" as any).select("*").eq("child_id", child.id).order("journal_date", { ascending: false }).limit(6),
    supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at").eq("child_id", child.id).limit(12),
    supabase.from("parent_child_requests" as any).select("*").eq("child_id", child.id).order("created_at", { ascending: false }).limit(8)
  ]);

  const latestJournal = (journalsRes.data ?? [])[0] as any;

  return (
    <DashboardShell role="parent" title="כרטיס ילד">
      <div className="parent-experience-shell">
        <section className="parent-child-hero compact">
          <div className="parent-child-photo"><Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" /></div>
          <div>
            <p className="eyebrow">כרטיס ילד</p>
            <h1>{child.full_name}</h1>
            <div className="parent-status-row">
              <span className={child.status === "active" || child.status === "approved" ? "pill good" : child.status === "rejected" ? "pill bad" : "pill warn"}>{statusLabel(child.status)}</span>
              <span className="pill good">{age(child.birth_date)}</span>
              <span className={child.allergies ? "pill bad" : "pill good"}>{child.allergies ? "יש אלרגיה מתועדת" : "אין אלרגיות"}</span>
            </div>
          </div>
          <div className="parent-hero-actions">
            <Link className="button secondary" href="/dashboard/parent">חזרה</Link>
            <Link className="button primary" href="/dashboard/parent/messages">פנייה לגן</Link>
          </div>
        </section>

        <section className="parent-two-column">
          <ChildPhotoUpload childId={child.id} initialUrl={child.photo_url ?? child.face_image_url} />
          <article className="parent-child-card-mini">
            <HeartPulse />
            <h2>מה חשוב לצוות לדעת?</h2>
            <div className="parent-trust-list">
              <span>אלרגיות <b>{child.allergies || "אין"}</b></span>
              <span>תרופות קבועות <b>{child.regular_medications || "אין"}</b></span>
              <span>איש קשר חירום <b>{child.emergency_phone || "לא צוין"}</b></span>
              <span>הערה רפואית <b>{child.medical_notes || "אין"}</b></span>
            </div>
          </article>
        </section>

        <section className="parent-two-column">
          <article className="parent-feed-card">
            <div className="section-heading"><h2>עדכונים אחרונים</h2><p>היומן מוצג כפיד קצר.</p></div>
            {(journalsRes.data ?? []).length === 0 ? <div className="empty-state"><strong>אין עדכונים עדיין</strong><span>כשהגן יעדכן את היום של הילד, זה יופיע כאן.</span></div> : <div className="parent-day-feed">{(journalsRes.data ?? []).map((journal: any) => <div className="parent-feed-item" key={journal.id}><time>{dateText(journal.journal_date)}</time><div><strong>{journal.mood ?? "עדכון מהגן"}</strong><span>{journal.notes_to_parents ?? journal.sleep_summary ?? "עודכן ביומן היומי"}</span></div></div>)}</div>}
          </article>
          <article className="parent-ai-card">
            <Baby />
            <h2>סיכום קצר</h2>
            <p>{latestJournal?.notes_to_parents ?? `${child.full_name} מחכה לעדכון יומי מהגן. ברגע שהצוות יעדכן, הסיכום יופיע כאן.`}</p>
            <div className="parent-question-list">
              <Link href="/dashboard/parent/daily-journal">יומן מלא</Link>
              <Link href="/dashboard/parent/pickup">מורשי איסוף</Link>
              <Link href="/dashboard/parent/messages">שאלה לצוות</Link>
            </div>
          </article>
        </section>

        <section className="parent-two-column">
          <article className="parent-trust-card">
            <UserRoundCheck />
            <h2>מורשי איסוף ומשפחה</h2>
            <div className="parent-trust-list">
              <span>תאריך לידה <b>{dateText(child.birth_date)}</b></span>
              <span>אם <b>{child.mother_name ?? "לא צוין"}</b></span>
              <span>אב <b>{child.father_name ?? "לא צוין"}</b></span>
              <span>מורשי איסוף <b>{Array.isArray(child.pickup_authorized) ? child.pickup_authorized.length : 0}</b></span>
            </div>
          </article>
          <article className="parent-trust-card">
            <ShieldCheck />
            <h2>סטטוס רישום</h2>
            <p>{statusLabel(child.status)}</p>
            <p>{child.approval_notes ?? child.manager_response ?? "אין הערת מנהלת."}</p>
            {child.status === "pending_parent_completion" || child.status === "request_missing_details" ? <Link className="button primary" href={`/parent-onboarding?childId=${child.id}`}>השלמת פרטים</Link> : null}
          </article>
        </section>

        <details className="parent-advanced-details">
          <summary>מסמכים ובקשות</summary>
          <div className="parent-two-column">
            <article className="card action-panel">
              <h2><FileText size={18} /> מסמכים</h2>
              {(docsRes.data ?? []).length === 0 ? <div className="empty-mini">אין מסמכים להצגה.</div> : (docsRes.data ?? []).map((doc: any) => <div className="list-item" key={doc.id}><strong>{doc.name ?? doc.document_type}</strong><span className="pill">{doc.status}</span></div>)}
            </article>
            <article className="card action-panel">
              <h2>פניות</h2>
              {(requestsRes.data ?? []).length === 0 ? <div className="empty-mini">אין פניות לילד זה.</div> : (requestsRes.data ?? []).map((request: any) => <div className="list-item" key={request.id}><div><strong>{request.request_type}</strong><span>{request.content}</span></div><span className="pill">{request.status}</span></div>)}
            </article>
          </div>
        </details>
      </div>
    </DashboardShell>
  );
}
