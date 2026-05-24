import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenDocumentsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at, file_url").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false });
  const rows = (data ?? []).map((doc: any) => ({ ...doc, title: doc.name, description: `${doc.document_type} · תוקף ${doc.expires_at ? new Date(doc.expires_at).toLocaleDateString("he-IL") : "לא הוגדר"}` }));
  return <DashboardShell role="manager" title="מסמכים"><ModuleListPage title="מרכז מסמכי גן" eyebrow="Document Center" description="מסמכי גן, צוות, ילדים, אישורי מצלמות, תברואה, בטיחות ותוקף." rows={rows} emptyTitle="אין מסמכים עדיין" emptyText="העלו מסמכים מתוך תהליך הקליטה או מרכז המסמכים. מסמכים חסרים יוצגו לאדמין ולפקח." /></DashboardShell>;
}
