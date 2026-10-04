import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { GardenPickupVerificationPanel } from "@/components/pickup-verification-panels";
import { StaffAppFrame, StaffEmpty, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

export default async function StaffPickupPage() {
  const { profile, employment } = await requireOperationalRole(["staff"]);
  const supabase = await createClient();
  const gardenId = employment!.garden_id;
  const staffId = employment!.staff_id;
  const teaching = await supabase.rpc("can_teach_in_garden" as never, { target_garden_id: gardenId, required_scope: "attendance" } as never);
  const assignmentsRes = await supabase.from("staff_classroom_assignments" as never).select("classroom_id" as never).eq("staff_id", staffId).eq("garden_id", gardenId).eq("status", "active").limit(100);
  const classroomIds = ((assignmentsRes.data ?? []) as unknown as Array<{ classroom_id: string }>).map((item) => item.classroom_id);
  const childAssignmentsRes = classroomIds.length ? await supabase.from("child_classroom_assignments" as never).select("child_id" as never).eq("garden_id", gardenId).eq("is_current", true).in("classroom_id", classroomIds).limit(500) : { data: [], error: null };
  const childIds = ((childAssignmentsRes.data ?? []) as unknown as Array<{ child_id: string }>).map((item) => item.child_id);
  const [childrenRes, contactsRes, eventsRes] = childIds.length ? await Promise.all([
    supabase.from("children" as never).select("id,full_name,photo_url" as never).eq("garden_id", gardenId).in("id", childIds).order("full_name"),
    supabase.from("authorized_pickup_contacts" as never).select("*,children(full_name,photo_url)" as never).eq("kindergarten_id", gardenId).in("child_id", childIds).order("created_at", { ascending: false }),
    supabase.from("child_pickup_events" as never).select("*,children(full_name,photo_url)" as never).eq("kindergarten_id", gardenId).in("child_id", childIds).order("pickup_time", { ascending: false }).limit(80)
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const allowed = teaching.data === true && !teaching.error;

  return <StaffAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url ?? null}>
    <div className="ux06-staff-operations">
      <StaffPageHero eyebrow="איסוף ילדים" title="אישור שחרור" text="הרשאה תקפה ואישור צוות נבדקים יחד ברגע השחרור." icon={ShieldCheck} badge={<StatusChip tone={allowed ? "success" : "danger"}>{allowed ? "מורשה לפי כיתה" : "גישה חסומה"}</StatusChip>} />
      <StaffSection title="בדיקת מורשה ואישור צוות" action={<Link className="button secondary tiny" href="/dashboard/staff/children-attendance">חזרה לנוכחות</Link>}>
        {allowed ? <GardenPickupVerificationPanel childRows={(childrenRes.data ?? []) as unknown as Record<string, unknown>[]} contacts={(contactsRes.data ?? []) as unknown as Record<string, unknown>[]} events={(eventsRes.data ?? []) as unknown as Record<string, unknown>[]} currentTime={new Date().toISOString()} /> : <StaffEmpty title="אין הרשאה לפעולת איסוף" text="נדרשת העסקה פעילה, כיתה מורשית והרשאת נוכחות." icon={ShieldCheck} />}
      </StaffSection>
      <p className="ux06-authority-note"><ShieldCheck size={18} /> מורשה מבוטל, שפג תוקפו או שאינו מאושר חוסם שחרור. מצלמה אינה סמכות שחרור.</p>
    </div>
  </StaffAppFrame>;
}
