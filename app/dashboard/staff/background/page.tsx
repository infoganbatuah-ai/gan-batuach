import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id, full_name, approved_to_work, police_clearance_status, background_check_status, role, created_at").eq("profile_id", profile.id).maybeSingle();
  const staff = staffRes.data as any;
  const docsRes = staff?.id ? await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, file_url").eq("staff_id", staff.id).in("document_type", ["sexual_offense_clearance", "criminal_clearance", "police_clearance", "background_check"]).limit(20) : { data: [] };
  const docs = (docsRes.data ?? []) as any[];
  return <DashboardShell role="staff" title="בדיקות רקע"><div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">אישור עבודה</p><h1>תעודת יושר ובדיקות רקע.</h1><p>העובד מאושר כפעיל רק לאחר העלאת מסמכי חובה, בדיקת מנהלת ואפשרות בדיקת פקח.</p></div><span className={staff?.approved_to_work ? "pill good" : "pill warn"}>{staff?.approved_to_work ? "מאושר/ת" : "ממתין לאישור"}</span></div><section className="grid cols-3 dashboard-panels"><article className="card action-panel"><h2>תעודת היעדר עבירות מין</h2><p>סטטוס: {staff?.police_clearance_status ?? "missing"}</p></article><article className="card action-panel"><h2>בדיקת רקע פלילי</h2><p>סטטוס: {staff?.background_check_status ?? "missing"}</p></article><article className="card action-panel"><h2>אישור מנהלת</h2><p>{staff?.approved_to_work ? "העובד סומן כמאושר לעבודה." : "נדרש אישור מנהלת לאחר בדיקת מסמכים."}</p></article></section><section className="dashboard-section">{docs.length === 0 ? <div className="empty-state"><strong>לא נמצאו מסמכי רקע</strong><span>כאשר יועלו תעודת היעדר עבירות מין ובדיקת רקע, הסטטוס והקבצים יוצגו כאן.</span></div> : <div className="document-center-grid">{docs.map((doc) => <article className="card document-card" key={doc.id}><div><span className="pill">{doc.status}</span><h3>{doc.name}</h3><p>{doc.document_type}</p></div>{doc.file_url ? <a className="button secondary tiny" href={doc.file_url}>צפייה</a> : null}</article>)}</div>}</section></DashboardShell>;
}
