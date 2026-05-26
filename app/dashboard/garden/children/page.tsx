import { DashboardShell } from "@/components/dashboard-shell";
import { ChildrenProfileCards } from "@/components/people-profile-cards";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenChildrenPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const [childrenRes, attendanceRes, journalsRes, incidentsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, birth_date, identity_number, status, allergies, sensitivities, regular_medications, medical_notes, hmo, emergency_phone, photo_url, face_image_url, pickup_authorized, mother_name, father_name, mother_phone, father_phone, monthly_fee, payment_status, last_payment_date, next_payment_due, valid_until, payment_notes, created_at, updated_at").eq("garden_id", gardenId).order("full_name"),
    supabase.from("attendance" as any).select("child_id, status, pickup_authorized, pickup_name, note").eq("garden_id", gardenId).eq("attendance_date", today),
    supabase.from("child_daily_journals" as any).select("child_id, meals, sleep_summary, mood, bathroom, incidents, notes_to_parents, photo_urls").eq("garden_id", gardenId).eq("journal_date", today),
    supabase.from("incident_reports" as any).select("child_id, id").eq("garden_id", gardenId).neq("status", "closed")
  ]);
  const attendanceByChild = new Map((attendanceRes.data ?? []).map((row: any) => [row.child_id, row]));
  const journalByChild = new Map((journalsRes.data ?? []).map((row: any) => [row.child_id, row]));
  const incidentCount = new Map<string, number>();
  for (const incident of (incidentsRes.data ?? []) as any[]) incidentCount.set(incident.child_id, (incidentCount.get(incident.child_id) ?? 0) + 1);
  const rows = ((childrenRes.data ?? []) as any[]).map((child) => {
    const attendance = attendanceByChild.get(child.id) as any;
    const journal = journalByChild.get(child.id) as any;
    const meals = Array.isArray(journal?.meals) ? journal.meals.map((meal: any) => meal.text ?? meal).join(", ") : "";
    return {
      ...child,
      attendance_status: attendance?.status ?? "not_updated",
      pickup_status: attendance?.pickup_name ? `נאסף על ידי ${attendance.pickup_name}` : "ממתין לאיסוף",
      pickup_authorized: attendance?.pickup_authorized,
      meals_text: meals,
      sleep_summary: journal?.sleep_summary,
      mood: journal?.mood,
      notes_to_parents: journal?.notes_to_parents,
      photo_urls: journal?.photo_urls ?? [],
      incident_count: incidentCount.get(child.id) ?? 0
    };
  });

  return (
    <DashboardShell role="manager" title="ילדים">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Children Profiles</p><h1>מערכת כרטיסי ילדים חכמה.</h1><p>לא עוד רשימה אפורה: תמונה, נוכחות, בריאות, איסוף, יומן יומי ואירועים בכרטיס אחד.</p></div><span className="pill good">{rows.length} ילדים</span></div>
      <div className="grid cols-4 dashboard-kpis"><StatCard label="נוכחים היום" value={rows.filter((row) => row.attendance_status === "present").length} tone="good" /><StatCard label="טרם עודכנו" value={rows.filter((row) => row.attendance_status === "not_updated").length} tone="warn" /><StatCard label="אלרגיות" value={rows.filter((row) => row.allergies).length} tone="bad" /><StatCard label="אירועים פתוחים" value={rows.reduce((sum, row) => sum + Number(row.incident_count ?? 0), 0)} tone="warn" /></div>
      <ChildrenProfileCards children={rows} />
    </DashboardShell>
  );
}
