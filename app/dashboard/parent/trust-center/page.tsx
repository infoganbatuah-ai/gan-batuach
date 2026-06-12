import Link from "next/link";
import { BookOpenCheck, CalendarDays, ClipboardCheck, FileText, HeartHandshake, MessageCircleHeart, MessageSquareWarning, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentTrustCenterActions } from "@/components/parent-trust-center-actions";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { complaintParentStatus, parentTrustTone, parentTrustVisibilityRules, trustBadgeLabel, trustFeedLabel } from "@/lib/domain/parent-trust";
import { createClient } from "@/lib/supabase/server";

function date(value: unknown) {
  if (!value) return "";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("he-IL");
}

export default async function ParentTrustCenterV2Page() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const gardenId = family.gardenIds[0] ?? profile.garden_id ?? "";
  const parentIds = family.parentIds;

  const [trustRes, transparencyRes, feedRes, inspectionsRes, complaintsRes, educationRes, announcementsRes, calendarRes, surveysRes, feedbackRes, requestsRes, participationRes] = await Promise.all([
    gardenId ? supabase.from("parent_trust_profiles" as any).select("*, gardens(name,city,safe_status)").eq("garden_id", gardenId).maybeSingle() : Promise.resolve({ data: null }),
    gardenId ? supabase.from("parent_transparency_scores" as any).select("*").eq("garden_id", gardenId).order("calculated_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    gardenId ? supabase.from("parent_trust_feed" as any).select("*").eq("garden_id", gardenId).eq("approved_for_parents", true).order("occurred_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("inspections" as any).select("id,weighted_score,completed_at,violation_count,summary,status").eq("garden_id", gardenId).eq("status", "done").order("completed_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    parentIds.length ? supabase.from("complaints" as any).select("id,subject,severity,status,created_at,closed_at").in("parent_id", parentIds).order("created_at", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    supabase.from("parent_trust_education_items" as any).select("*").eq("active", true).order("display_order", { ascending: true }).limit(8),
    gardenId ? supabase.from("community_announcements" as any).select("*").eq("garden_id", gardenId).eq("published", true).order("published_at", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("community_calendar_events" as any).select("*").eq("garden_id", gardenId).eq("visible_to_parents", true).gte("starts_at", new Date(Date.now() - 86400000).toISOString()).order("starts_at", { ascending: true }).limit(8) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("parent_surveys" as any).select("*").or(`garden_id.eq.${gardenId},garden_id.is.null`).eq("status", "active").eq("visible_to_parents", true).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    supabase.from("parent_feedback_items" as any).select("*").eq("parent_profile_id", profile.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("parent_request_center_items" as any).select("*").eq("parent_profile_id", profile.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("parent_participation_items" as any).select("*").eq("parent_profile_id", profile.id).order("created_at", { ascending: false }).limit(8)
  ]);

  const trust = (trustRes.data ?? {}) as any;
  const transparency = (transparencyRes.data ?? {}) as any;
  const feed = (feedRes.data ?? []) as any[];
  const inspections = (inspectionsRes.data ?? []) as any[];
  const complaints = (complaintsRes.data ?? []) as any[];
  const education = (educationRes.data ?? []) as any[];
  const announcements = (announcementsRes.data ?? []) as any[];
  const calendar = (calendarRes.data ?? []) as any[];
  const surveys = (surveysRes.data ?? []) as any[];
  const feedback = (feedbackRes.data ?? []) as any[];
  const requests = (requestsRes.data ?? []) as any[];
  const participation = (participationRes.data ?? []) as any[];
  const latestInspection = inspections[0];

  return (
    <DashboardShell role="parent" title="Trust Center">
      <div className="commercial-dashboard parent-trust-network-shell">
        <PremiumDashboardHero
          eyebrow="Trust Center"
          title="אמון, שקיפות וקהילה"
          subtitle="כל מה שהורה צריך לדעת: בטיחות, ציות, צוות, ביקורות, הודעות, בקשות ואירועים. רק מידע מאושר ובטוח מוצג כאן."
          badge={`${trust.trust_score ?? 0}/100`}
          badgeTone={parentTrustTone(Number(trust.trust_score ?? 0))}
          actions={<><Link className="button primary" href="/dashboard/parent/messages">מרכז תקשורת</Link><Link className="button secondary" href="/dashboard/parent/notifications">התראות</Link></>}
        >
          <div className="setup-checklist"><span>{trustBadgeLabel(trust.trust_badge_status)}</span><span>{trust.gardens?.name ?? "גן משויך"}</span><span>אין מידע פנימי רגיש</span></div>
        </PremiumDashboardHero>

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="אמון" value={`${trust.trust_score ?? 0}/100`} tone={parentTrustTone(Number(trust.trust_score ?? 0))} />
          <RoleMetricCard label="שקיפות" value={`${transparency.transparency_score ?? 0}/100`} hint={transparency.explanation ?? "מדד עדכונים ותקשורת"} tone={parentTrustTone(Number(transparency.transparency_score ?? 0))} />
          <RoleMetricCard label="ציות" value={`${trust.compliance_score ?? 0}/100`} tone={parentTrustTone(Number(trust.compliance_score ?? 0))} />
          <RoleMetricCard label="ביקורת אחרונה" value={latestInspection?.weighted_score ?? "-"} hint={date(latestInspection?.completed_at) || "טרם פורסמה"} tone={latestInspection ? "good" : "warn"} />
          <RoleMetricCard label="מוכנות צוות" value={`${trust.staff_readiness_score ?? transparency.document_readiness_score ?? 0}/100`} tone={parentTrustTone(Number(trust.staff_readiness_score ?? transparency.document_readiness_score ?? 0))} />
          <RoleMetricCard label="תקשורת" value={`${transparency.communication_quality_score ?? trust.response_score ?? 0}/100`} tone={parentTrustTone(Number(transparency.communication_quality_score ?? trust.response_score ?? 0))} />
          <RoleMetricCard label="פניות שלי" value={feedback.length + requests.length + complaints.length} tone={(feedback.length + requests.length + complaints.length) ? "warn" : "good"} />
          <RoleMetricCard label="קהילה" value={announcements.length + calendar.length} hint="עדכונים ואירועים" tone="good" />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> מצב בטיחות וציות</h2>
            <div className="parent-trust-list">
              <span>{trust.parent_summary ?? "סיכום אמון יוצג לאחר חישוב הדירוג."}</span>
              <span>{trust.latest_inspection_summary ?? "סיכום ביקורת מאושר יופיע כאן לאחר פרסום."}</span>
              <span>מוצגים רק נתונים מאושרים להורים.</span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><Sparkles size={20} /> עוזר הורים</h2>
            <div className="parent-trust-list">
              <span>מה השתנה: {feed[0]?.title ?? announcements[0]?.title ?? "אין עדכון חדש"}</span>
              <span>מה דורש תשומת לב: {requests.some((item) => item.lifecycle_status !== "closed") ? "יש בקשה בטיפול" : surveys.length ? "אפשר לענות לסקר קצר" : "אין פעולה דחופה"}</span>
              <span>אירוע קרוב: {calendar[0]?.title ?? "לא פורסם אירוע קרוב"}</span>
            </div>
          </article>
        </section>

        <CleanSection title="פיד שקיפות" subtitle="ביקורות, שיפורים ועדכונים שאושרו להצגה.">
          {feed.length === 0 ? <EmptyState title="אין עדיין עדכוני שקיפות" text="עדכונים מאושרים יופיעו כאן." /> : <div className="parent-trust-feed">{feed.map((item) => <article key={item.id}><StatusBadge tone="good">{trustFeedLabel(item.feed_type)}</StatusBadge><div><strong>{item.title}</strong><span>{item.summary}</span><small>{date(item.occurred_at)}</small></div></article>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><MessageCircleHeart size={20} /> הודעות קהילה</h2>
            {announcements.length === 0 ? <div className="empty-mini">אין הודעות קהילה כרגע.</div> : announcements.map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.body}</span></div><StatusBadge tone="good">{item.announcement_type}</StatusBadge></div>)}
          </article>
          <article className="card action-panel">
            <h2><CalendarDays size={20} /> לוח קהילה</h2>
            {calendar.length === 0 ? <div className="empty-mini">אין אירועים קרובים.</div> : calendar.map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{date(item.starts_at)} · {item.description}</span></div><StatusBadge tone={item.participation_enabled ? "good" : "default"}>{item.event_type}</StatusBadge></div>)}
          </article>
        </section>

        <ParentTrustCenterActions surveys={surveys as any[]} events={calendar as any[]} />

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><MessageSquareWarning size={20} /> משוב ובקשות</h2>{[...feedback, ...requests].length === 0 ? <div className="empty-mini">אין בקשות פתוחות.</div> : [...feedback, ...requests].slice(0, 8).map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{date(item.created_at)}</span></div><StatusBadge tone={parentTrustTone(item.lifecycle_status)}>{complaintParentStatus(item.lifecycle_status)}</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><UsersRound size={20} /> השתתפות</h2>{participation.length === 0 ? <div className="empty-mini">אין השתתפויות רשומות.</div> : participation.map((item) => <div className="list-item" key={item.id}><div><strong>{item.participation_type}</strong><span>{date(item.created_at)}</span></div><StatusBadge tone="good">{item.status}</StatusBadge></div>)}</article>
        </section>

        <CleanSection title="גבולות שקיפות" subtitle="שקיפות טובה שומרת גם על פרטיות.">
          <div className="parent-trust-rule-grid">{parentTrustVisibilityRules.map((rule) => <span key={rule}>{rule}</span>)}</div>
        </CleanSection>

        <CleanSection title="מרכז ידע להורים" subtitle="בטיחות, נהלים, חירום ושימוש במערכת.">
          <div className="parent-trust-education-grid">{education.map((item) => <article key={item.id}><BookOpenCheck /><strong>{item.title}</strong><span>{item.summary}</span></article>)}</div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="תקשורת" text="הודעות, בקשות ותשובות" href="/dashboard/parent/messages" icon={MessageCircleHeart} />
          <ActionCard title="ביקורות" text="סיכומים מאושרים" href="/dashboard/parent/inspections" icon={ClipboardCheck} />
          <ActionCard title="מסמכים" text="אישורים וטפסים" href="/dashboard/parent/documents" icon={FileText} />
          <ActionCard title="התראות" text="עדכונים חשובים" href="/dashboard/parent/notifications" icon={HeartHandshake} />
        </section>
      </div>
    </DashboardShell>
  );
}
