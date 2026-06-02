import Link from "next/link";
import { CheckCircle2, CircleAlert, ClipboardCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function status(ok: boolean) {
  return ok ? <span className="pill good"><CheckCircle2 size={14} /> תקין</span> : <span className="pill warn"><CircleAlert size={14} /> דורש בדיקה</span>;
}

export default async function QaChecklistPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("qa checklist", async () => {
    const supabase = await createClient();
    const [profiles, gardens, inspections, parents, staff, complaints, documents, cameras, aiEvents, policies, reports] = await Promise.all([
      supabase.from("profiles" as any).select("id", { count: "exact", head: true }).like("email", "%@demo.ganbatuach.com"),
      supabase.from("gardens" as any).select("id", { count: "exact", head: true }).in("name", ["גן רקפת הקטנה", "גן אורנים הירוק", "גן שקד וחברים", "גן תמרים", "גן ים של ילדים"]),
      supabase.from("inspections" as any).select("id", { count: "exact", head: true }).not("weighted_score", "is", null),
      supabase.from("parents" as any).select("id", { count: "exact", head: true }),
      supabase.from("staff" as any).select("id", { count: "exact", head: true }),
      supabase.from("complaints" as any).select("id", { count: "exact", head: true }),
      supabase.from("documents" as any).select("id", { count: "exact", head: true }),
      supabase.from("camera_streams" as any).select("id", { count: "exact", head: true }).in("status", ["pending_gateway", "offline", "failed", "error"]),
      supabase.from("ai_events" as any).select("id", { count: "exact", head: true }),
      supabase.from("policy_acceptances" as any).select("id", { count: "exact", head: true }),
      supabase.from("inspection_signatures" as any).select("id", { count: "exact", head: true })
    ]);
    return {
      usersSeeded: profiles.count ?? 0,
      gardens: gardens.count ?? 0,
      inspections: inspections.count ?? 0,
      parents: parents.count ?? 0,
      staff: staff.count ?? 0,
      complaints: complaints.count ?? 0,
      documents: documents.count ?? 0,
      cameras: cameras.count ?? 0,
      aiEvents: aiEvents.count ?? 0,
      policies: policies.count ?? 0,
      reports: reports.count ?? 0
    };
  }, { usersSeeded: 0, gardens: 0, inspections: 0, parents: 0, staff: 0, complaints: 0, documents: 0, cameras: 0, aiEvents: 0, policies: 0, reports: 0 });
  const data = result.data;
  const checks = [
    ["משתמשי דמו נוצרו", data.usersSeeded >= 10, `${data.usersSeeded} משתמשים בדומיין demo.ganbatuach.com`, "/dashboard/admin/users"],
    ["גני דמו קיימים", data.gardens >= 5, `${data.gardens}/5 גנים`, "/dashboard/admin/kindergartens"],
    ["ביקורות ודוחות קיימים", data.inspections >= 3 && data.reports >= 3, `${data.inspections} ביקורות · ${data.reports} חתימות`, "/dashboard/admin/inspections"],
    ["זרימת הורים ניתנת לבדיקה", data.parents >= 3, `${data.parents} הורים`, "/dashboard/parent"],
    ["זרימת צוות ניתנת לבדיקה", data.staff >= 3, `${data.staff} אנשי צוות`, "/dashboard/staff"],
    ["פניות ותלונות קיימות", data.complaints > 0, `${data.complaints} פניות`, "/dashboard/admin/complaints"],
    ["מסמכים לבדיקה קיימים", data.documents > 0, `${data.documents} מסמכים`, "/dashboard/admin/documents"],
    ["מצלמות pending קיימות", data.cameras > 0, `${data.cameras} מצלמות/תקלות`, "/dashboard/admin/cameras"],
    ["אירועי AI קיימים", data.aiEvents > 0, `${data.aiEvents} אירועים`, "/dashboard/admin/ai-events"],
    ["אישורי תקנון", data.policies > 0, `${data.policies} אישורים`, "/dashboard/admin/policies"]
  ] as const;

  return (
    <DashboardShell role="admin" title="QA Checklist">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Operational QA</p>
          <h1>רשימת בדיקה לסביבת דמו מלאה.</h1>
          <p>העמוד בודק אם קיימים נתונים אמיתיים במסכים המרכזיים כדי לבדוק את גן בטוח כמו מערכת פעילה.</p>
        </div>
        <Link className="button primary" href="/dashboard/admin/demo-control">Demo Control</Link>
      </div>
      <AdminDataError message={result.error} />
      <section className="dashboard-section">
        <div className="section-heading"><h2><ClipboardCheck size={20} /> סטטוס בדיקות</h2><p>אם שורה מסומנת “דורש בדיקה”, הרץ npm run seed:demo-full או צור דוגמה ממרכז הדמו.</p></div>
        <div className="procedure-list">
          {checks.map(([label, ok, detail, href]) => <Link className="card procedure-card" href={href} key={label}><div><h3>{label}</h3><p>{detail}</p></div><div className="procedure-meta">{status(ok)}<span>פתיחה</span></div></Link>)}
        </div>
      </section>
    </DashboardShell>
  );
}
