import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { AdminReportsCenter } from "@/components/admin-reports-center";
import { ComplaintWorkspace } from "@/components/complaint-workspace";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ComponentProps } from "react";

type ComplaintRows = ComponentProps<typeof ComplaintWorkspace>["rows"];
type IncidentRow = Record<string, unknown>;

async function settleReportQuery(query: () => PromiseLike<{ data: unknown; error: unknown }>, index: number) {
  const label = `דיווחים ופניות ${index}`;
  const result = await safeAdminData(label, async () => {
    const { data, error } = await query();
    logSupabaseError(label, error);
    return { data: error ? null : data, available: !error };
  }, { data: null, available: false });
  return result.data;
}

export default async function AdminReportsAndComplaintsPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("דיווחים ופניות", async () => {
    const supabase = createAdminClient();
    const [complaintsRes, incidentsRes] = await Promise.all([
      () => supabase.from("complaints" as never).select("*, gardens(name, city), parents(full_name), children(full_name), assignee:assigned_to(full_name)").order("created_at", { ascending: false }).limit(150),
      () => supabase.from("incident_reports" as never).select("*, gardens(name, city), children(full_name), assignee:assigned_to(full_name), reporter:reported_by(full_name, role)").order("created_at", { ascending: false }).limit(150)
    ].map(settleReportQuery));
    return { complaints: (complaintsRes.data ?? []) as unknown as ComplaintRows, incidents: (incidentsRes.data ?? []) as unknown as IncidentRow[], complaintsAvailable: complaintsRes.available, incidentsAvailable: incidentsRes.available, queryError: !complaintsRes.available || !incidentsRes.available ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { complaints: [] as ComplaintRows, incidents: [] as IncidentRow[], complaintsAvailable: false, incidentsAvailable: false, queryError: null as string | null });

  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/complaints" title="תלונות והסלמות" subtitle="פיקוח פלטפורמה לפי הרשאה, SLA והצורך התפעולי." badge="תלונות">
    <AdminDataError message={result.error ?? result.data.queryError} />
    {result.data.complaintsAvailable ? <ComplaintWorkspace rows={result.data.complaints} role="admin" title="תלונות מכל המערכת" scopeMessage="תצוגת אדמין מורשית. פעולות ותוכן מוצגים לפי מדיניות ההרשאה והבידוד הקנונית." /> : <section className="card" role="status" aria-label="נתוני פניות לא זמינים">נתוני הפניות אינם זמינים</section>}
    {!result.data.incidentsAvailable ? <section className="card" role="status" aria-label="נתוני אירועים לא זמינים">נתוני האירועים אינם זמינים</section> : result.data.incidents.length ? <details className="teacher-management-details"><summary>דיווחי אירוע נפרדים</summary><AdminReportsCenter complaints={[]} incidents={result.data.incidents} /></details> : null}
  </AdminAppFrame>;
}
