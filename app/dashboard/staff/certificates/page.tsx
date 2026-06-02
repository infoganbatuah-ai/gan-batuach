import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id, full_name").eq("profile_id", profile.id).maybeSingle();
  const staff = staffRes.data as any;
  const certsRes = staff?.id ? await supabase.from("staff_certificates" as any).select("id, certificate_type, file_url, issued_at, expires_at, status, created_at").eq("staff_id", staff.id).order("expires_at", { ascending: true }).limit(50) : { data: [] };
  const rows = (certsRes.data ?? []) as any[];
  const expiring = rows.filter((row) => row.expires_at && new Date(row.expires_at).getTime() < Date.now() + 30 * 86400000).length;
  return <DashboardShell role="staff" title="תעודות"><div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">מסמכי עובד</p><h1>תעודות, הכשרות ותוקף מסמכים.</h1><p>כאן מופיעות תעודות חובה, הכשרות ותאריכי תפוגה. מסמך חסר או שפג תוקפו דורש טיפול לפני אישור עבודה מלא.</p></div><span className={expiring ? "pill warn" : "pill good"}>{expiring} עומדים לפוג</span></div><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין תעודות במערכת</strong><span>העלאת תעודות מתבצעת דרך מנהלת הגן או מרכז המסמכים, ולאחר אישור הן יוצגו כאן.</span></div> : <div className="document-center-grid">{rows.map((row) => <article className="card document-card" key={row.id}><div><span className={row.status === "valid" || row.status === "approved" ? "pill good" : row.status === "rejected" ? "pill bad" : "pill warn"}>{row.status}</span><h3>{row.certificate_type}</h3><p>הונפק: {row.issued_at ? new Date(row.issued_at).toLocaleDateString("he-IL") : "לא צוין"}</p><small>תוקף: {row.expires_at ? new Date(row.expires_at).toLocaleDateString("he-IL") : "לא הוגדר"}</small></div>{row.file_url ? <a className="button secondary tiny" href={row.file_url}>צפייה</a> : <span className="pill warn">קובץ חסר</span>}</article>)}</div>}</section></DashboardShell>;
}
