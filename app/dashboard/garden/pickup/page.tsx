import { Bell, MapPinned, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { GardenPickupVerificationPanel } from "@/components/pickup-verification-panels";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function GardenPickupPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const access = await getManagementGardenContext();
  if (!access.allowed) notFound();
  const { profile } = access.session;
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = access.gardenId;
  const gardenRes = await supabase.from("gardens" as any).select("operational_timezone").eq("id", gardenId).maybeSingle();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: gardenRes.data?.operational_timezone || "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [enrollmentsRes, contactsRes, eventsRes, attendanceRes] = await Promise.all([
    supabase.from("child_kindergarten_enrollments" as any).select("child_id,start_date,end_date,children(id,full_name,photo_url,pickup_authorized)").eq("garden_id", gardenId).eq("status", "active").limit(500),
    supabase.from("authorized_pickup_contacts" as any).select("*, children(full_name, photo_url)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(300),
    supabase.from("child_pickup_events" as any).select("*, children(full_name, photo_url)").eq("kindergarten_id", gardenId).order("pickup_time", { ascending: false }).limit(100),
    supabase.from("attendance" as any).select("child_id,check_in_at,check_out_at").eq("garden_id", gardenId).eq("attendance_date", today).limit(500)
  ]);
  const allChildren = ((enrollmentsRes.data ?? []) as any[])
    .filter((row) => (!row.start_date || row.start_date <= today) && (!row.end_date || row.end_date >= today))
    .map((row) => Array.isArray(row.children) ? row.children[0] : row.children).filter(Boolean);
  const todayAttendance = (attendanceRes.data ?? []) as any[];
  const awaitingPickupIds = new Set(todayAttendance.filter((row) => row.check_in_at && !row.check_out_at).map((row) => row.child_id));
  const children = params.filter === "pending" ? allChildren.filter((child) => awaitingPickupIds.has(child.id)) : allChildren;
  const contacts = (contactsRes.data ?? []) as any[];
  const events = params.filter === "pending" ? [] : ((eventsRes.data ?? []) as any[]);
  const pendingPickup = allChildren.filter((child) => awaitingPickupIds.has(child.id)).length;
  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="איסוף והחזרה בטוחים" avatarUrl={(profile as any).profile_image_url ?? null} active="children">
      <TeacherPageTitle icon={MapPinned} title="איסוף והחזרה" subtitle="מי רשאי לאסוף ומי נאסף בפועל, בלי שחרור אוטומטי" />
      <TeacherStatsGrid>
        <TeacherStatCard title="ילדים להצגה" value={children.length} hint="לפי הסינון" icon={UsersRound} tone="blue" />
        <TeacherStatCard title="טרם נאספו" value={pendingPickup} hint="זקוקים לעדכון" icon={UserCheck} tone={pendingPickup ? "orange" : "green"} />
        <TeacherStatCard title="מורשי איסוף" value={contacts.length} hint="פעילים במערכת" icon={ShieldCheck} tone="purple" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות איסוף">
        <TeacherActionTile title="לא נאספו" href="/dashboard/garden/pickup?filter=pending" icon={UserCheck} tone="orange" />
        <TeacherActionTile title="הודעה להורים" href="/dashboard/garden/messages?compose=1#message-workbench" icon={Bell} tone="purple" />
        <TeacherActionTile title="כרטיסי ילדים" href="/dashboard/garden/children" icon={UsersRound} tone="blue" />
      </TeacherQuickActions>
      <DashboardFilterChip label={params.filter === "pending" ? "איסופים שלא הושלמו" : null} clearHref="/dashboard/garden/pickup" isEmpty={children.length === 0} emptyTitle="אין כרגע איסופים שלא הושלמו" emptyText="כל הילדים במסנן הזה נאספו או שאין ילדים פעילים להצגה." />
      <TeacherSection title="ניהול איסוף" subtitle="הרשאות, אירועים ואישור אנושי">
        <div className="teacher-embedded-module">
          <GardenPickupVerificationPanel children={children} contacts={contacts} events={events} currentTime={new Date().toISOString()} />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
