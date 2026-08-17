import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSystemHealthPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("system health", async () => {
    const supabase = await createClient();
    const [gardens, staff, children, cameras, policies] = await Promise.all([
      supabase.from("gardens" as any).select("id, name, city, manager_id, inspector_id, first_inspection_due_at, inspection_required_status, safe_status").limit(300),
      supabase.from("staff" as any).select("id, full_name, garden_id, background_check_status, police_clearance_status, approved_to_work, gardens(name)").limit(300),
      supabase.from("children" as any).select("id, full_name, garden_id, hmo, allergies, emergency_phone, medical_notes, gardens(name)").limit(300),
      supabase.from("camera_streams" as any).select("id, name, garden_id, status, ai_enabled, gardens(name)").limit(300),
      supabase.from("policy_acceptances" as any).select("id", { count: "exact", head: true })
    ]);
    [gardens, staff, children, cameras, policies].forEach((res, i) => logSupabaseError("system health " + i, res.error));
    const gardenRows = (gardens.data ?? []) as any[];
    const issues = [
      ...gardenRows.filter((g) => !g.manager_id).map((g) => ({ severity: "critical", title: "גן ללא מנהלת", garden: g.name, href: `/dashboard/admin/gardens/${g.id}`, fix: "שיוך/יצירת מנהלת גן" })),
      ...gardenRows.filter((g) => !g.inspector_id).map((g) => ({ severity: "high", title: "גן ללא פקח", garden: g.name, href: `/dashboard/admin/gardens/${g.id}`, fix: "שיוך פקח לפי עיר" })),
      ...gardenRows.filter((g) => g.inspection_required_status === "pending_first_inspection").map((g) => ({ severity: "high", title: "חסרה ביקורת ראשונה", garden: g.name, href: "/dashboard/admin/inspection-forms", fix: "דרישת פיקוח ראשונה" })),
      ...((staff.data ?? []) as any[]).filter((s) => !s.approved_to_work || s.background_check_status !== "valid" || s.police_clearance_status !== "valid").map((s) => ({ severity: "high", title: "איש צוות חסר אישורים", garden: s.gardens?.name, href: "/dashboard/admin/users", fix: s.full_name })),
      ...((children.data ?? []) as any[]).filter((c) => !c.hmo || !c.emergency_phone).map((c) => ({ severity: "medium", title: "ילד עם מידע רפואי חסר", garden: c.gardens?.name, href: `/dashboard/admin/gardens/${c.garden_id}`, fix: c.full_name })),
      ...((cameras.data ?? []) as any[]).filter((c) => c.status !== "online").map((c) => ({ severity: "medium", title: "מצלמה ממתינה/מנותקת", garden: c.gardens?.name, href: "/dashboard/admin/cameras", fix: c.name })),
      ...((cameras.data ?? []) as any[]).filter((c) => !c.ai_enabled).map((c) => ({ severity: "low", title: "AI כבוי במצלמה", garden: c.gardens?.name, href: "/dashboard/admin/ai-observer", fix: c.name }))
    ];
    return { issues, queryError: [gardens, staff, children, cameras].some((r) => r.error) ? "לא ניתן לטעון את כל מדדי הבריאות כרגע" : null };
  }, { issues: [] as any[], queryError: null as string | null });
  const issues = result.data.issues;
  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/notifications" title="בריאות מערכת" subtitle="פערי תפעול, הרשאות וספקים שדורשים טיפול." badge={issues.length ? `${issues.length} בעיות` : "ללא בעיות פתוחות"}><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">System Health</p><h1>מה חסר כדי שהמערכת תהיה מוכנה להפעלה מלאה?</h1><p>גנים ללא מנהלת/פקח, ביקורת ראשונה חסרה, צוות ללא מסמכים, ילדים עם מידע רפואי חסר, מצלמות ו־AI.</p></div><span className={issues.length ? "pill bad" : "pill good"}>{issues.length ? `${issues.length} בעיות` : "תקין"}</span></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="dashboard-section">{issues.length === 0 ? <div className="empty-state"><CheckCircle2 /><strong>אין בעיות מערכת פתוחות</strong><span>כאשר חסר Setup הכרחי, הוא יופיע כאן עם פעולה מומלצת.</span></div> : <div className="procedure-list">{issues.map((issue, index) => <article className="card procedure-card" key={index}><div><span className={issue.severity === "critical" || issue.severity === "high" ? "pill bad" : "pill warn"}><AlertTriangle size={14} /> {issue.severity}</span><h3>{issue.title}</h3><p>{issue.garden ?? "כללי"}</p><small>פעולה מומלצת: {issue.fix}</small></div><div className="procedure-meta"><Link className="button secondary" href={issue.href}><Activity size={15} /> טיפול</Link></div></article>)}</div>}</section></AdminAppFrame>;
}
