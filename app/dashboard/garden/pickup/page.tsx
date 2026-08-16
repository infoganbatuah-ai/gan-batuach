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
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenPickupPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, contactsRes, eventsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, pickup_authorized").eq("garden_id", gardenId).order("full_name"),
    supabase.from("authorized_pickup_contacts" as any).select("*, children(full_name, photo_url)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(300),
    supabase.from("child_pickup_events" as any).select("*, children(full_name, photo_url)").eq("kindergarten_id", gardenId).order("pickup_time", { ascending: false }).limit(100)
  ]);
  const pickedChildIds = new Set(((eventsRes.data ?? []) as any[]).map((row) => row.child_id).filter(Boolean));
  const children = params.filter === "pending" ? ((childrenRes.data ?? []) as any[]).filter((child) => !pickedChildIds.has(child.id)) : ((childrenRes.data ?? []) as any[]);
  const contacts = (contactsRes.data ?? []) as any[];
  const events = params.filter === "pending" ? [] : ((eventsRes.data ?? []) as any[]);
  const pendingPickup = ((childrenRes.data ?? []) as any[]).filter((child) => !pickedChildIds.has(child.id)).length;
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
          <GardenPickupVerificationPanel children={children} contacts={contacts} events={events} />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
