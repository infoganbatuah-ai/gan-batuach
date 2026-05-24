import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { AdminReportsCenter } from "@/components/admin-reports-center";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminReportsAndComplaintsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("דיווחים ופניות", async () => {
    const supabase = await createClient();
    const [complaintsRes, incidentsRes] = await Promise.all([
      supabase.from("complaints" as any).select("*, gardens(name, city), parents(full_name), children(full_name), assignee:assigned_to(full_name)").order("created_at", { ascending: false }).limit(150),
      supabase.from("incident_reports" as any).select("*, gardens(name, city), children(full_name), assignee:assigned_to(full_name), reporter:reported_by(full_name, role)").order("created_at", { ascending: false }).limit(150)
    ]);
    logSupabaseError("דיווחים ופניות", complaintsRes.error ?? incidentsRes.error);
    return { complaints: (complaintsRes.data ?? []) as any[], incidents: (incidentsRes.data ?? []) as any[], queryError: complaintsRes.error || incidentsRes.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { complaints: [] as any[], incidents: [] as any[], queryError: null as string | null });

  return <DashboardShell role="admin" title="דיווחים ופניות"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Reports & Complaints</p><h1>דיווחים, תלונות ופניות מכל המערכת.</h1><p>הורים, מנהלות, בעלים, צוות, פקחים, אתר ציבורי ואירועים פנימיים במקום אחד עם SLA, חומרה ופעולות טיפול.</p></div><span className="pill good">מרכז טיפול</span></div><AdminDataError message={result.error ?? result.data.queryError} /><AdminReportsCenter complaints={result.data.complaints} incidents={result.data.incidents} /></DashboardShell>;
}
