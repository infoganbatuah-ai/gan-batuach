import Link from "next/link";
import { CalendarDays, HeartHandshake, Megaphone, MessageSquareWarning, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
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

function toneForTrust(value: unknown): "red" | "orange" | "green" {
  const tone = parentTrustTone(typeof value === "number" ? value : Number(value ?? 0));
  return tone === "bad" ? "red" : tone === "warn" ? "orange" : "green";
}

type TrustProfile = { trust_score?: number | null; trust_badge_status?: string | null; gardens?: { name?: string | null } | null };
type Transparency = { transparency_score?: number | null };
type Contact = { id: string; title: string; created_at?: string | null; lifecycle_status?: string | null };
type Announcement = { id: string; title: string; published?: boolean; published_at?: string | null; announcement_type?: string | null };
type CalendarEvent = { title: string; starts_at?: string | null };
type Survey = { status?: string | null };
type TrustReport = { period_start?: string | null; period_end?: string | null };
async function trustQuery(label: string, query: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query();
    logSupabaseError(label, result.error);
    return result.error ? { data: null, error: true } : { data: result.data, error: false };
  } catch {
    logSupabaseError(label, true);
    return { data: null, error: true };
  }
}

export default async function GardenTrustCenterPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) {
    return <DashboardShell role="manager" title="אמון הורים" appHome><AdminDataError message="לא ניתן לטעון נתוני אמון ללא שיוך לגן" /></DashboardShell>;
  }
  const result = await safeAdminData("garden trust center", async () => {
    const supabase = await createClient();
    const [trustRes, transparencyRes, feedbackRes, requestsRes, announcementsRes, calendarRes, surveysRes, reportsRes] = await Promise.all([
      trustQuery("garden trust profile", () => supabase.from("parent_trust_profiles" as any).select("*, gardens(name,city)").eq("garden_id", gardenId).maybeSingle()),
      trustQuery("garden trust transparency", () => supabase.from("parent_transparency_scores" as any).select("*").eq("garden_id", gardenId).order("calculated_at", { ascending: false }).limit(1).maybeSingle()),
      trustQuery("garden trust feedback", () => supabase.from("parent_feedback_items" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(12)),
      trustQuery("garden trust requests", () => supabase.from("parent_request_center_items" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(12)),
      trustQuery("garden trust announcements", () => supabase.from("community_announcements" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(10)),
      trustQuery("garden trust calendar", () => supabase.from("community_calendar_events" as any).select("*").eq("garden_id", gardenId).order("starts_at", { ascending: true }).limit(10)),
      trustQuery("garden trust surveys", () => supabase.from("parent_surveys" as any).select("*").or(`garden_id.eq.${gardenId},garden_id.is.null`).order("created_at", { ascending: false }).limit(8)),
      trustQuery("garden trust reports", () => supabase.from("parent_trust_reports" as any).select("*").eq("garden_id", gardenId).order("period_end", { ascending: false }).limit(6))
    ]);
    const available = [trustRes, transparencyRes, feedbackRes, requestsRes, announcementsRes, calendarRes, surveysRes, reportsRes].map((query) => !query.error);
    return { trust: (trustRes.data ?? {}) as TrustProfile, transparency: (transparencyRes.data ?? {}) as Transparency,
      feedback: (feedbackRes.data ?? []) as Contact[], requests: (requestsRes.data ?? []) as Contact[], announcements: (announcementsRes.data ?? []) as Announcement[],
      calendar: (calendarRes.data ?? []) as CalendarEvent[], surveys: (surveysRes.data ?? []) as Survey[], reports: (reportsRes.data ?? []) as TrustReport[], available,
      queryError: available.some((value) => !value) ? "חלק מנתוני האמון לא נטענו" : null };
  }, { trust: {} as TrustProfile, transparency: {} as Transparency, feedback: [] as Contact[], requests: [] as Contact[], announcements: [] as Announcement[], calendar: [] as CalendarEvent[], surveys: [] as Survey[], reports: [] as TrustReport[], available: [false, false, false, false, false, false, false, false], queryError: null as string | null });
  const { trust, transparency, feedback, requests, announcements, calendar, surveys, reports, available } = result.data;
  const openFeedback = feedback.filter((item) => !["resolved", "closed"].includes(String(item.lifecycle_status)));
  const openRequests = requests.filter((item) => !["answered", "closed"].includes(String(item.lifecycle_status)));
  const score = !available[1] ? null : transparency.transparency_score != null ? Number(transparency.transparency_score) : available[0] ? Number(trust.trust_score ?? 0) : null;
  const contactsAvailable = available[2] && available[3];

  return (
    <DashboardShell role="manager" title="אמון הורים" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle={available[0] ? trust.gardens?.name ?? "אמון ושקיפות" : "שם הגן לא זמין"} avatarUrl={(profile as any).profile_image_url ?? null} active="messages">
        <TeacherPageTitle icon={ShieldCheck} title="מרכז אמון, שקיפות וקהילה" subtitle="תמונה אחת של אמון ההורים: עדכונים, בקשות, סקרים ואירועי קהילה" action={<Link className="button primary" href="/dashboard/garden/messages">תקשורת הורים</Link>} />
        <AdminDataError message={result.error ?? result.data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="שקיפות" value={available[1] ? `${transparency.transparency_score ?? 0}/100` : "לא זמין"} hint="ציון" icon={Sparkles} tone={available[1] ? toneForTrust(transparency.transparency_score) : "neutral"} />
          <TeacherStatCard title="אמון" value={available[0] ? `${trust.trust_score ?? 0}/100` : "לא זמין"} hint={available[0] ? trustBadgeLabel(trust.trust_badge_status) : "תג האמון לא זמין"} icon={HeartHandshake} tone={available[0] ? toneForTrust(trust.trust_score) : "neutral"} />
          <TeacherStatCard title="פניות פתוחות" value={contactsAvailable ? openFeedback.length + openRequests.length : "לא זמין"} hint="דורש תגובה" icon={MessageSquareWarning} tone={!contactsAvailable ? "neutral" : openFeedback.length + openRequests.length ? "orange" : "green"} />
          <TeacherStatCard title="הודעות קהילה" value={available[4] ? announcements.length : "לא זמין"} hint="עדכונים" icon={Megaphone} tone={available[4] ? "purple" : "neutral"} />
        </TeacherStatsGrid>

        <section className="teacher-children-layout">
          <TeacherSection title="משוב ובקשות הורים" action={<Link href="/dashboard/garden/parents">הורים ›</Link>}>
            <AdminDataError message={!contactsAvailable ? "חלק מהמשובים והבקשות אינם זמינים" : null} />
            {[...feedback, ...requests].length === 0 ? (
              contactsAvailable ? <TeacherEmptyState title="אין עדיין פניות אמון" text="משובים ובקשות הורים יופיעו כאן אחרי פתיחה." /> : <TeacherEmptyState title="פניות האמון לא זמינות במלואן" text="לא ניתן להסיק שאין פניות פתוחות." />
            ) : (
              <TeacherCompactList>
                {[...feedback, ...requests].slice(0, 8).map((item) => (
                  <TeacherCompactItem key={item.id} title={item.title} subtitle={date(item.created_at)} tone={["resolved", "closed"].includes(String(item.lifecycle_status)) ? "green" : "orange"} meta={statusLabel(item.lifecycle_status)} />
                ))}
              </TeacherCompactList>
            )}
          </TeacherSection>

          <TeacherSection title="הודעות קהילה" action={<Link href="/dashboard/garden/messages">הודעות ›</Link>}>
            {!available[4] ? <TeacherEmptyState title="הודעות הקהילה לא זמינות" text="לא ניתן לטעון הודעות קהילה כרגע." /> : announcements.length === 0 ? (
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
            <TeacherCompactItem title="סקרים פעילים" subtitle={available[6] ? "מדידת שביעות רצון ואמון" : "הסקרים לא זמינים"} tone={!available[6] ? "neutral" : surveys.some((survey) => survey.status === "active") ? "green" : "orange"} meta={available[6] ? surveys.length : "לא זמין"} />
            <TeacherCompactItem title="אירועי קהילה" subtitle={!available[5] ? "אירועי הקהילה לא זמינים" : calendar[0] ? `${calendar[0].title} · ${date(calendar[0].starts_at)}` : "אין אירועים קרובים"} tone={available[5] ? "blue" : "neutral"} meta={available[5] ? calendar.length : "לא זמין"} />
            <TeacherCompactItem title="דוחות אמון" subtitle={!available[7] ? "דוחות האמון לא זמינים" : reports[0] ? `${date(reports[0].period_start)} - ${date(reports[0].period_end)}` : "טרם הופקו דוחות"} tone={available[7] ? "purple" : "neutral"} meta={available[7] ? reports.length : "לא זמין"} />
          </TeacherCompactList>
        </TeacherSection>

        <TeacherAiInsight metric={score === null ? "לא זמין" : `${score}/100`}>
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
