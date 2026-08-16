import Link from "next/link";
import { CalendarDays, HeartHandshake, Megaphone, MessageSquareWarning, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { parentTrustTone, trustBadgeLabel } from "@/lib/domain/parent-trust";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAiInsight,
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

function toneForTrust(value: unknown) {
  const tone = parentTrustTone(typeof value === "number" ? value : Number(value ?? 0));
  return tone === "bad" ? "red" : tone === "warn" ? "orange" : "green";
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
  const score = Number(transparency.transparency_score ?? trust.trust_score ?? 0);

  return (
    <DashboardShell role="manager" title="אמון הורים" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle={trust.gardens?.name ?? "אמון ושקיפות"} avatarUrl={(profile as any).profile_image_url ?? null} active="messages">
        <TeacherPageTitle icon={ShieldCheck} title="מרכז אמון, שקיפות וקהילה" subtitle="תמונה אחת של אמון ההורים: עדכונים, בקשות, סקרים ואירועי קהילה" action={<Link className="button primary" href="/dashboard/garden/messages">תקשורת הורים</Link>} />

        <TeacherStatsGrid>
          <TeacherStatCard title="שקיפות" value={`${transparency.transparency_score ?? 0}/100`} hint="ציון" icon={Sparkles} tone={toneForTrust(transparency.transparency_score)} />
          <TeacherStatCard title="אמון" value={`${trust.trust_score ?? 0}/100`} hint={trustBadgeLabel(trust.trust_badge_status)} icon={HeartHandshake} tone={toneForTrust(trust.trust_score)} />
          <TeacherStatCard title="פניות פתוחות" value={openFeedback.length + openRequests.length} hint="דורש תגובה" icon={MessageSquareWarning} tone={openFeedback.length + openRequests.length ? "orange" : "green"} />
          <TeacherStatCard title="הודעות קהילה" value={announcements.length} hint="עדכונים" icon={Megaphone} tone="purple" />
        </TeacherStatsGrid>

        <section className="teacher-children-layout">
          <TeacherSection title="משוב ובקשות הורים" action={<Link href="/dashboard/garden/parents">הורים ›</Link>}>
            {[...feedback, ...requests].length === 0 ? (
              <TeacherEmptyState title="אין עדיין פניות אמון" text="משובים ובקשות הורים יופיעו כאן אחרי פתיחה." />
            ) : (
              <TeacherCompactList>
                {[...feedback, ...requests].slice(0, 8).map((item) => (
                  <TeacherCompactItem key={item.id} title={item.title} subtitle={date(item.created_at)} tone={["resolved", "closed"].includes(String(item.lifecycle_status)) ? "green" : "orange"} meta={statusLabel(item.lifecycle_status)} />
                ))}
              </TeacherCompactList>
            )}
          </TeacherSection>

          <TeacherSection title="הודעות קהילה" action={<Link href="/dashboard/garden/messages">הודעות ›</Link>}>
            {announcements.length === 0 ? (
              <TeacherEmptyState title="אין הודעות קהילה" text="טיוטות ופרסומים להורים יוצגו כאן." />
            ) : (
              <TeacherCompactList>
                {announcements.slice(0, 6).map((item) => (
                  <TeacherCompactItem key={item.id} title={item.title} subtitle={item.published ? `פורסם ${date(item.published_at)}` : "טיוטה"} tone={item.published ? "green" : "purple"} meta={item.announcement_type} />
                ))}
              </TeacherCompactList>
            )}
          </TeacherSection>
        </section>

        <TeacherSection title="סקרים, אירועים ודוחות">
          <TeacherCompactList>
            <TeacherCompactItem title="סקרים פעילים" subtitle="מדידת שביעות רצון ואמון" tone={surveys.some((survey) => survey.status === "active") ? "green" : "orange"} meta={surveys.length} />
            <TeacherCompactItem title="אירועי קהילה" subtitle={calendar[0] ? `${calendar[0].title} · ${date(calendar[0].starts_at)}` : "אין אירועים קרובים"} tone="blue" meta={calendar.length} />
            <TeacherCompactItem title="דוחות אמון" subtitle={reports[0] ? `${date(reports[0].period_start)} - ${date(reports[0].period_end)}` : "טרם הופקו דוחות"} tone="purple" meta={reports.length} />
          </TeacherCompactList>
        </TeacherSection>

        <TeacherAiInsight metric={`${score}/100`}>
          להורים מוצגים רק סיכומים מאושרים. חקירות פנימיות, אירועי AI גולמיים ומידע אישי אינם מוצגים.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות אמון">
          <TeacherActionTile title="הודעות להורים" href="/dashboard/garden/messages" icon={Megaphone} tone="purple" />
          <TeacherActionTile title="הורים" href="/dashboard/garden/parents" icon={MessageSquareWarning} tone="blue" />
          <TeacherActionTile title="מסמכים" href="/dashboard/garden/documents" icon={ShieldCheck} tone="green" />
          <TeacherActionTile title="פיקוח" href="/dashboard/garden/inspections" icon={CalendarDays} tone="orange" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
