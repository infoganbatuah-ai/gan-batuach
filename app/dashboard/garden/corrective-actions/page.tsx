import { ViolationStatusActions } from "@/components/violation-status-actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

export default async function GardenCorrectiveActionsPage() {
  const { profile } = await requireOperationalRole(["manager", "owner"]);
  const { data } = await (await createClient()).from("violations" as never)
    .select("id,title,description,severity,status,correction_due_at,review_note,correction_files,created_at")
    .eq("garden_id", profile.garden_id).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as Array<{ id: string; title: string; description: string | null; severity: string; status: string; correction_due_at: string | null; review_note: string | null; correction_files: string[] }>;
  const open = rows.filter((row) => row.status !== "done").length;
  return <DashboardShell role="manager" title="פעולות תיקון" appHome><TeacherAppFrame title="ליקויים ופעולות תיקון" subtitle="טיפול בליקויים ותיעוד לפקח" active="more">
  <main className="dashboard-content" dir="rtl">
    <h1>ליקויים ופעולות תיקון</h1><p>{open} פעולות פתוחות · {rows.length - open} נסגרו לאחר בדיקת פקח</p>
    {rows.length === 0 && <p>אין פעולות תיקון לביצוע.</p>}
    {rows.map((row) => <section className="card" key={row.id}>
      <h2>{row.title}</h2><p>{row.description}</p>
      <p>חומרה: {row.severity} · יעד: {row.correction_due_at ? new Date(row.correction_due_at).toLocaleDateString("he-IL") : "לא הוגדר"}</p>
      {row.review_note && <p>תגובת הפקח: {row.review_note}</p>}
      {Array.isArray(row.correction_files) && row.correction_files.map((path) => <a key={path} href={`/api/violations/${row.id}/evidence?path=${encodeURIComponent(path)}`}>ראיית תיקון</a>)}
      <ViolationStatusActions id={row.id} initialStatus={row.status} role="garden" />
    </section>)}
  </main></TeacherAppFrame></DashboardShell>;
}
