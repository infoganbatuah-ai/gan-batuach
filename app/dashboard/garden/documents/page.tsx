import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenDocumentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at, file_url").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false });
  const rows = (data ?? [])
    .filter((doc: any) => {
      if (params.filter === "missing") return ["missing", "required", "expired", "rejected"].includes(doc.status);
      if (params.filter === "review") return doc.status === "pending_review";
      return true;
    })
    .map((doc: any) => ({ ...doc, title: doc.name, description: `${doc.document_type} · תוקף ${doc.expires_at ? new Date(doc.expires_at).toLocaleDateString("he-IL") : "לא הוגדר"}` }));
  return <DashboardShell role="manager" title="מסמכים"><DashboardFilterChip label={params.filter === "missing" ? "מסמכים חסרים / דחויים / פגי תוקף" : params.filter === "review" ? "מסמכים שממתינים לאישור" : null} clearHref="/dashboard/garden/documents" isEmpty={rows.length === 0} emptyTitle={params.filter === "missing" ? "אין כרגע מסמכים חסרים" : params.filter === "review" ? "אין כרגע מסמכים שממתינים לאישור" : undefined} emptyText="כל המסמכים במסנן הזה תקינים כרגע." /><ModuleListPage title="מרכז מסמכי גן" eyebrow="Document Center" description="מסמכי גן, צוות, ילדים, אישורי מצלמות, תברואה, בטיחות ותוקף." rows={rows} emptyTitle={params.filter === "missing" ? "אין כרגע מסמכים חסרים" : "אין מסמכים עדיין"} emptyText={params.filter === "missing" ? "אין מסמכים חסרים, דחויים או פגי תוקף כרגע." : "העלו מסמכים מתוך תהליך הקליטה או מרכז המסמכים. מסמכים חסרים יוצגו לאדמין ולפקח."} /></DashboardShell>;
}
