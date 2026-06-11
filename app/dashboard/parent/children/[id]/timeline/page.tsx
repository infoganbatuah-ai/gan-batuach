import Link from "next/link";
import { Baby, FileText, HeartPulse, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { childTimelinePrivacyRules, childTimelineQuestions, eventDateText, eventTimeText, timelineCategoryLabel, timelineTone } from "@/lib/domain/child-safety-timeline";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function dayKey(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "unknown";
}

export default async function ParentChildTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireRole(["parent"]);
  const { id } = await params;
  const userScopedSupabase = await createClient();
  const supabase = isAdminClientConfigured() ? createAdminClient() : userScopedSupabase;
  const family = await getParentFamilyContext(userScopedSupabase as any, profile);
  const familyChild = (family.children as any[]).find((item) => item.id === id || item.permanent_child_file_id === id);
  const familyEnrollment = (family.enrollments as any[]).find((item) => item.child_id === id || item.permanent_child_file_id === id);
  const childId = familyChild?.id ?? familyEnrollment?.child_id ?? null;

  if (!childId) {
    return <DashboardShell role="parent" title="ציר ילד"><EmptyState title="לא נמצא כרטיס ילד" text="הילד אינו משויך לחשבון שלך." action={<Link className="button primary" href="/dashboard/parent">חזרה</Link>} /></DashboardShell>;
  }

  const [childRes, recordRes, timelineRes] = await Promise.all([
    supabase.from("children" as any).select("id,full_name,photo_url,face_image_url,birth_date,classroom,age_group,allergies,medical_notes,status").eq("id", childId).maybeSingle(),
    supabase.from("child_unified_records" as any).select("*").eq("child_id", childId).maybeSingle(),
    supabase.from("child_timeline_events" as any).select("*").eq("child_id", childId).eq("parent_visible", true).eq("internal_only", false).in("visibility", ["parent", "approved_parent"]).order("event_time", { ascending: false }).limit(120)
  ]);

  const child = (childRes.data as any) ?? familyChild;
  const record = recordRes.data as any;
  const timeline = ((timelineRes.data ?? []) as any[]).filter((event) => event.parent_visible && !event.internal_only && ["parent", "approved_parent"].includes(String(event.visibility)));
  const today = timeline.filter((item) => dayKey(item.event_time) === new Date().toISOString().slice(0, 10));
  const health = timeline.filter((item) => item.event_category === "health");
  const pickup = timeline.filter((item) => item.event_category === "pickup");
  const grouped = timeline.reduce((map: Map<string, any[]>, item: any) => {
    const key = dayKey(item.event_time);
    map.set(key, [...(map.get(key) ?? []), item]);
    return map;
  }, new Map<string, any[]>());

  return (
    <DashboardShell role="parent" title="ציר היום">
      <div className="parent-experience-shell child-timeline-shell">
        <PremiumDashboardHero
          eyebrow="Child Timeline"
          title={`היום של ${child.full_name}`}
          subtitle="עדכונים מאושרים מהגן במקום אחד: פעילות, ארוחות, שינה, בריאות, מסמכים, הודעות ואיסוף."
          badge={`${timeline.length} עדכונים`}
          badgeTone={today.length ? "good" : "warn"}
          actions={<><Link className="button primary" href="/dashboard/parent/messages">שאלה לגן</Link><Link className="button secondary" href={`/dashboard/parent/children/${child.id}`}>כרטיס ילד</Link></>}
        >
          <div className="child-timeline-hero-card">
            <Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} />
            <span>{child.classroom ?? child.age_group ?? "גן"}</span>
          </div>
        </PremiumDashboardHero>

        <section className="parent-metric-strip">
          <RoleMetricCard label="עדכונים היום" value={today.length} tone={today.length ? "good" : "warn"} />
          <RoleMetricCard label="בריאות" value={health.length} hint="עדכונים מאושרים" tone={health.length ? "warn" : "good"} />
          <RoleMetricCard label="איסוף" value={pickup.length} hint="רישומים" tone={pickup.length ? "good" : "default"} />
          <RoleMetricCard label="עדכון אחרון" value={record?.last_event_at ? eventDateText(record.last_event_at) : "-"} tone="default" />
        </section>

        <section className="parent-two-column">
          <article className="parent-ai-card">
            <Sparkles />
            <h2>סיכום קצר</h2>
            <p>{record?.daily_summary ?? `כאשר הגן יעדכן את היום של ${child.full_name}, הסיכום יופיע כאן.`}</p>
            <div className="parent-question-list">{childTimelineQuestions.map((question) => <Link href={`/dashboard/parent/children/${child.id}/timeline`} key={question}>{question}</Link>)}</div>
          </article>
          <article className="parent-trust-card">
            <ShieldCheck />
            <h2>מה מוצג כאן?</h2>
            <p>רק עדכונים שאושרו לשיתוף הורים. מידע פנימי, חקירות וטיוטות לא מוצגים כאן.</p>
            <div className="parent-trust-list">
              <span>פרטיות <b>מוגנת</b></span>
              <span>אירועים פנימיים <b>מוסתרים</b></span>
              <span>שפה <b>רגועה וברורה</b></span>
            </div>
          </article>
        </section>

        <CleanSection title="ציר זמן" subtitle="פיד קצר וברור, לא דוח.">
          {timeline.length === 0 ? <EmptyState title="אין עדכונים מאושרים עדיין" text="כשהגן יעדכן וישתף אירוע, הוא יופיע כאן." /> : (
            <div className="child-timeline-days">
              {Array.from(grouped.entries()).map(([date, items]: [string, any[]]) => <section className="child-timeline-day" key={date}>
                <h3>{date === "unknown" ? "ללא תאריך" : new Date(date).toLocaleDateString("he-IL")}</h3>
                <div className="child-timeline-list">{items.map((item: any) => <article className={`child-timeline-item ${timelineTone(item.event_category, item.safety_relevance)}`} key={item.id}>
                  <time>{eventTimeText(item.event_time)}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.summary_safe ?? item.description ?? ""}</span>
                    <small>{timelineCategoryLabel(item.event_category)}</small>
                  </div>
                  <StatusBadge tone={timelineTone(item.event_category, item.safety_relevance)}>{timelineCategoryLabel(item.event_category)}</StatusBadge>
                </article>)}</div>
              </section>)}
            </div>
          )}
        </CleanSection>

        <section className="parent-two-column">
          <article className="parent-trust-card">
            <HeartPulse />
            <h2>בריאות</h2>
            <div className="parent-trust-list">
              <span>אלרגיות <b>{child.allergies || "אין"}</b></span>
              <span>הערה רפואית <b>{child.medical_notes || "אין"}</b></span>
              <span>עדכוני בריאות בציר <b>{health.length}</b></span>
            </div>
          </article>
          <article className="parent-trust-card">
            <Baby />
            <h2>פעולות מהירות</h2>
            <div className="parent-question-list">
              <Link href="/dashboard/parent/daily-journal">יומן יומי</Link>
              <Link href="/dashboard/parent/pickup">איסוף</Link>
              <Link href="/dashboard/parent/documents"><FileText size={16} /> מסמכים</Link>
              <Link href="/dashboard/parent/messages"><MessageCircle size={16} /> הודעות</Link>
            </div>
          </article>
        </section>

        <details className="parent-advanced-details">
          <summary>כללי פרטיות</summary>
          <div className="setup-checklist">{childTimelinePrivacyRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
        </details>
      </div>
    </DashboardShell>
  );
}
