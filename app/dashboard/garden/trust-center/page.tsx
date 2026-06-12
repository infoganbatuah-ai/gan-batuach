import Link from "next/link";
import { CalendarDays, HeartHandshake, Megaphone, MessageSquareWarning, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { parentTrustTone, trustBadgeLabel } from "@/lib/domain/parent-trust";
import { createClient } from "@/lib/supabase/server";

function date(value: unknown) {
  if (!value) return "";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("he-IL");
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    received: "התקבל",
    under_review: "בטיפול",
    in_progress: "בטיפול",
    answered: "נענה",
    resolved: "טופל",
    closed: "נסגר"
  };
  return labels[status ?? "received"] ?? "בטיפול";
}

export default async function GardenTrustCenterPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const supabase = await createClient();

  const [trustRes, transparencyRes, feedbackRes, requestsRes, announcementsRes, calendarRes, surveysRes, reportsRes] = await Promise.all([
    gardenId ? supabase.from("parent_trust_profiles" as any).select("*, gardens(name,city)").eq("garden_id", gardenId).maybeSingle() : Promise.resolve({ data: null }),
    gardenId ? supabase.from("parent_transparency_scores" as any).select("*").eq("garden_id", gardenId).order("calculated_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    gardenId ? supabase.from("parent_feedback_items" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("parent_request_center_items" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("community_announcements" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("community_calendar_events" as any).select("*").eq("garden_id", gardenId).order("starts_at", { ascending: true }).limit(10) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("parent_surveys" as any).select("*").or(`garden_id.eq.${gardenId},garden_id.is.null`).order("created_at", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("parent_trust_reports" as any).select("*").eq("garden_id", gardenId).order("period_end", { ascending: false }).limit(6) : Promise.resolve({ data: [] })
  ]);

  const trust = (trustRes.data ?? {}) as any;
  const transparency = (transparencyRes.data ?? {}) as any;
  const feedback = (feedbackRes.data ?? []) as any[];
  const requests = (requestsRes.data ?? []) as any[];
  const announcements = (announcementsRes.data ?? []) as any[];
  const calendar = (calendarRes.data ?? []) as any[];
  const surveys = (surveysRes.data ?? []) as any[];
  const reports = (reportsRes.data ?? []) as any[];
  const openFeedback = feedback.filter((item) => !["resolved", "closed"].includes(String(item.lifecycle_status)));
  const openRequests = requests.filter((item) => !["answered", "closed"].includes(String(item.lifecycle_status)));

  return (
    <DashboardShell role="manager" title="אמון הורים">
      <div className="commercial-dashboard parent-trust-network-shell">
        <PremiumDashboardHero
          eyebrow="Parent Trust"
          title="מרכז אמון, שקיפות וקהילה"
          subtitle="תמונה אחת של אמון ההורים: עדכונים, זמני תגובה, ביקורות, מסמכים, פניות, סקרים ואירועי קהילה."
          badge={`${transparency.transparency_score ?? trust.trust_score ?? 0}/100`}
          badgeTone={parentTrustTone(Number(transparency.transparency_score ?? trust.trust_score ?? 0))}
          actions={<><Link className="button primary" href="/dashboard/garden/messages">תקשורת הורים</Link><Link className="button secondary" href="/dashboard/garden/parents">הורים</Link></>}
        >
          <div className="setup-checklist">
            <span>{trust.gardens?.name ?? "הגן שלי"}</span>
            <span>{trustBadgeLabel(trust.trust_badge_status)}</span>
            <span>מידע פנימי נשאר פנימי</span>
          </div>
        </PremiumDashboardHero>

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="שקיפות" value={`${transparency.transparency_score ?? 0}/100`} tone={parentTrustTone(Number(transparency.transparency_score ?? 0))} />
          <RoleMetricCard label="אמון" value={`${trust.trust_score ?? 0}/100`} tone={parentTrustTone(Number(trust.trust_score ?? 0))} />
          <RoleMetricCard label="תקשורת" value={`${transparency.communication_quality_score ?? trust.response_score ?? 0}/100`} tone={parentTrustTone(Number(transparency.communication_quality_score ?? trust.response_score ?? 0))} />
          <RoleMetricCard label="פניות פתוחות" value={openFeedback.length + openRequests.length} tone={openFeedback.length + openRequests.length ? "warn" : "good"} />
          <RoleMetricCard label="תדירות עדכונים" value={`${transparency.update_frequency_score ?? 0}/100`} tone={parentTrustTone(Number(transparency.update_frequency_score ?? 0))} />
          <RoleMetricCard label="מוכנות מסמכים" value={`${transparency.document_readiness_score ?? trust.compliance_score ?? 0}/100`} tone={parentTrustTone(Number(transparency.document_readiness_score ?? trust.compliance_score ?? 0))} />
          <RoleMetricCard label="הודעות קהילה" value={announcements.length} tone="good" />
          <RoleMetricCard label="סקרים" value={surveys.length} tone={surveys.some((survey) => survey.status === "active") ? "good" : "warn"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Sparkles size={20} /> המלצות אמון</h2>
            <div className="parent-trust-list">
              <span>{transparency.explanation ?? "עדיין אין הסבר מדד. לאחר חישוב שקיפות יוצגו כאן גורמים לשיפור."}</span>
              <span>{openFeedback.length ? `יש ${openFeedback.length} משובים שדורשים תגובה.` : "אין משובים פתוחים."}</span>
              <span>{openRequests.length ? `יש ${openRequests.length} בקשות הורים פתוחות.` : "אין בקשות הורים פתוחות."}</span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> שקיפות בטוחה</h2>
            <div className="parent-trust-list">
              <span>להורים מוצגים רק סיכומים מאושרים.</span>
              <span>חקירות פנימיות, אירועי AI גולמיים ומידע אישי אינם מוצגים.</span>
              <span>פניות ותגובות נשמרות עם היסטוריה מסודרת.</span>
            </div>
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><MessageSquareWarning size={20} /> משוב ובקשות הורים</h2>
            {[...feedback, ...requests].length === 0 ? <div className="empty-mini">אין עדיין פניות אמון.</div> : [...feedback, ...requests].slice(0, 10).map((item) => (
              <div className="list-item" key={item.id}>
                <div><strong>{item.title}</strong><span>{date(item.created_at)}</span></div>
                <StatusBadge tone={parentTrustTone(item.lifecycle_status)}>{statusLabel(item.lifecycle_status)}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Megaphone size={20} /> הודעות קהילה</h2>
            {announcements.length === 0 ? <div className="empty-mini">אין הודעות קהילה.</div> : announcements.map((item) => (
              <div className="list-item" key={item.id}>
                <div><strong>{item.title}</strong><span>{item.published ? `פורסם ${date(item.published_at)}` : "טיוטה"}</span></div>
                <StatusBadge tone={item.published ? "good" : "warn"}>{item.announcement_type}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <CleanSection title="סקרים, אירועים ודוחות" subtitle="כלים למדידת אמון וקהילה בלי להציף את ההורים.">
          <section className="grid cols-3 dashboard-panels">
            <article className="card action-panel">
              <h2><HeartHandshake size={20} /> סקרים</h2>
              {surveys.length === 0 ? <EmptyState title="אין סקרים" text="סקרי אמון ושביעות רצון יופיעו כאן." /> : surveys.map((survey) => <div className="list-item" key={survey.id}><div><strong>{survey.title}</strong><span>{survey.description}</span></div><StatusBadge tone={survey.status === "active" ? "good" : "warn"}>{survey.status}</StatusBadge></div>)}
            </article>
            <article className="card action-panel">
              <h2><CalendarDays size={20} /> לוח קהילה</h2>
              {calendar.length === 0 ? <EmptyState title="אין אירועים" text="אירועים וימי קהילה יופיעו כאן." /> : calendar.map((event) => <div className="list-item" key={event.id}><div><strong>{event.title}</strong><span>{date(event.starts_at)}</span></div><StatusBadge tone={event.visible_to_parents ? "good" : "warn"}>{event.event_type}</StatusBadge></div>)}
            </article>
            <article className="card action-panel">
              <h2><ShieldCheck size={20} /> דוחות אמון</h2>
              {reports.length === 0 ? <EmptyState title="אין דוחות עדיין" text="דוח חודשי יופיע לאחר הפקת מדדים." /> : reports.map((report) => <div className="list-item" key={report.id}><div><strong>{report.report_type}</strong><span>{date(report.period_start)} - {date(report.period_end)}</span></div><StatusBadge tone={parentTrustTone(Number(report.trust_score ?? 0))}>{report.trust_score}/100</StatusBadge></div>)}
            </article>
          </section>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="הודעות להורים" text="ניהול תקשורת" href="/dashboard/garden/messages" icon={Megaphone} />
          <ActionCard title="בקשות הורים" text="פניות ותגובות" href="/dashboard/garden/parents" icon={MessageSquareWarning} />
          <ActionCard title="מסמכים" text="שקיפות וציות" href="/dashboard/garden/documents" icon={ShieldCheck} />
          <ActionCard title="פיקוח" text="ביקורות וסיכומים" href="/dashboard/garden/inspections" icon={CalendarDays} />
        </section>
      </div>
    </DashboardShell>
  );
}
