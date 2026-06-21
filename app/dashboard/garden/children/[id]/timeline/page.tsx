import Link from "next/link";
import { Activity, AlertTriangle, Baby, FileText, HeartPulse, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
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
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { childTimelinePrivacyRules, childTimelineQuestions, eventDateText, eventTimeText, timelineCategoryLabel, timelineTone } from "@/lib/domain/child-safety-timeline";

function dayKey(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "unknown";
}

export default async function GardenChildTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const { id } = await params;
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("child safety timeline", async () => {
    const supabase = await createClient();
    const [childRes, recordRes, timelineRes, casesRes] = await Promise.all([
      supabase.from("children" as any).select("id,full_name,photo_url,face_image_url,birth_date,classroom,age_group,allergies,medical_notes,regular_medications,status,garden_id").eq("id", id).eq("garden_id", gardenId).maybeSingle(),
      supabase.from("child_unified_records" as any).select("*").eq("child_id", id).maybeSingle(),
      supabase.from("child_timeline_events" as any).select("*, gardens(name)").eq("child_id", id).eq("garden_id", gardenId).order("event_time", { ascending: false }).limit(160),
      supabase.from("incident_cases" as any).select("id,case_number,title,severity,status,created_at").eq("child_id", id).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(20)
    ]);
    [childRes, recordRes, timelineRes, casesRes].forEach((query, index) => logSupabaseError(`child timeline query ${index}`, (query as any).error));
    return {
      child: childRes.data as any,
      record: recordRes.data as any,
      timeline: (timelineRes.data ?? []) as any[],
      cases: (casesRes.data ?? []) as any[],
      queryError: [childRes.error, timelineRes.error].some(Boolean) ? "חלק מנתוני ציר הזמן לא נטענו" : null
    };
  }, { child: null as any, record: null as any, timeline: [] as any[], cases: [] as any[], queryError: null as string | null });

  const data = result.data;
  if (!data.child) {
    return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="ציר ילד"><TeacherEmptyState title="לא נמצא ילד" text="ייתכן שהילד לא שייך לגן שלך." action={<Link className="teacher-soft-button purple" href="/dashboard/garden/children">חזרה לילדים</Link>} /></DashboardShell>;
  }

  const parentVisible = data.timeline.filter((item) => item.parent_visible && !item.internal_only);
  const incidents = data.timeline.filter((item) => item.event_category === "incidents" || item.safety_relevance === "incident");
  const health = data.timeline.filter((item) => item.event_category === "health");
  const today = data.timeline.filter((item) => dayKey(item.event_time) === new Date().toISOString().slice(0, 10));
  const grouped = data.timeline.reduce((map: Map<string, any[]>, item: any) => {
    const key = dayKey(item.event_time);
    map.set(key, [...(map.get(key) ?? []), item]);
    return map;
  }, new Map<string, any[]>());

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="ציר בטיחות ילד" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`}
        subtitle={`ציר בטיחות של ${data.child.full_name}`}
        avatarUrl={(profile as any).avatar_url ?? null}
        active="children"
      >
        <TeacherPageTitle
          icon={Baby}
          title={`כרטיס זמן של ${data.child.full_name}`}
          subtitle={`${data.child.classroom ?? data.child.age_group ?? "קבוצה לא הוגדרה"} · אירועים, בריאות, איסוף ועדכונים במקום אחד.`}
          action={<Link className="teacher-soft-button purple" href={`/dashboard/garden/children/${data.child.id}`}>כרטיס ילד</Link>}
        />
        <AdminDataError message={result.error ?? data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="אירועים בציר" value={data.timeline.length} icon={Sparkles} tone={data.timeline.length ? "green" : "orange"} />
          <TeacherStatCard title="היום" value={today.length} hint="עדכונים" icon={Activity} tone={today.length ? "green" : "orange"} />
          <TeacherStatCard title="גלוי להורים" value={parentVisible.length} icon={MessageCircle} tone="green" />
          <TeacherStatCard title="תיקי בדיקה" value={data.cases.length} icon={AlertTriangle} tone={data.cases.length ? "orange" : "green"} />
        </TeacherStatsGrid>

        <TeacherSection title="סיכום בטוח" subtitle="מידע תפעולי למנהלת בלבד. הורים רואים רק מה שאושר.">
          <p className="ganenet-module-subtitle">{data.record?.daily_summary ?? "עדיין אין סיכום יומי. הסיכום משתמש רק באירועי ציר הזמן."}</p>
          <TeacherCompactList>
            {childTimelinePrivacyRules.slice(0, 4).map((rule) => <TeacherCompactItem key={rule} title={rule} tone="purple" />)}
          </TeacherCompactList>
        </TeacherSection>

        <TeacherQuickActions title="פעולות ילד">
          <TeacherActionTile title="הודעה להורה" href={`/dashboard/garden/messages?childId=${data.child.id}`} icon={MessageCircle} tone="purple" />
          <TeacherActionTile title="כרטיס ילד" href={`/dashboard/garden/children/${data.child.id}`} icon={Baby} tone="blue" />
          <TeacherActionTile title="בריאות" href={`/dashboard/garden/health?childId=${data.child.id}`} icon={HeartPulse} tone="green" />
        </TeacherQuickActions>

        <TeacherSection title="ציר זמן מלא" subtitle="כל העדכונים נשארים מסודרים לפי ימים.">
          {data.timeline.length === 0 ? <TeacherEmptyState title="אין עדיין אירועים בציר" text="עדכונים מהגן, בריאות, איסוף ומסמכים יופיעו כאן." /> : (
            <TeacherCompactList>
              {Array.from(grouped.entries()).flatMap(([date, items]: [string, any[]]) => [
                <TeacherCompactItem key={`day-${date}`} title={date === "unknown" ? "ללא תאריך" : new Date(date).toLocaleDateString("he-IL")} subtitle="יום בציר הזמן" tone="neutral" />,
                ...items.map((item: any) => (
                  <TeacherCompactItem
                    key={item.id}
                    title={item.title}
                    subtitle={`${eventTimeText(item.event_time)} · ${timelineCategoryLabel(item.event_category)} · ${item.parent_visible ? "גלוי להורים" : "פנימי"}`}
                    meta={item.description ?? item.summary_safe ?? ""}
                    tone={timelineTone(item.event_category, item.safety_relevance) === "bad" ? "red" : timelineTone(item.event_category, item.safety_relevance) === "warn" ? "orange" : "purple"}
                  />
                ))
              ])}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherSection title="בריאות ותפעול">
          <TeacherCompactList>
            <TeacherCompactItem title="נוכחות" subtitle={`${data.record?.attendance_trend?.present_days_30d ?? 0} ימים ב-30 יום`} tone="green" />
            <TeacherCompactItem title="תרופות" subtitle={`${data.record?.health_trend?.medicine_events ?? 0} אירועים`} tone="orange" />
            <TeacherCompactItem title="אלרגיות" subtitle={data.child.allergies || "אין"} tone={data.child.allergies ? "red" : "green"} />
            <TeacherCompactItem title="עדכונים להורים" subtitle={`${parentVisible.length} פריטים`} tone="blue" />
          </TeacherCompactList>
        </TeacherSection>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
