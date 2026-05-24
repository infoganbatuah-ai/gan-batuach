import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ParentDocumentsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const parentRes = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const { data } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at").or(`garden_id.eq.${profile.garden_id ?? ""},parent_id.eq.${(parentRes.data as any)?.id ?? "00000000-0000-0000-0000-000000000000"}`).order("created_at", { ascending: false });
  return <DashboardShell role="parent" title="מסמכים"><ModuleListPage title="מסמכים ואישורים להורה" eyebrow="Documents" description="אישורי פרטיות, בריאות, צילום, מצלמות ומסמכים שהגן שיתף עם ההורה." rows={(data ?? []) as any[]} emptyTitle="אין מסמכים להצגה" emptyText="כאשר הגן יעלה או יאשר מסמך רלוונטי למשפחה, הוא יופיע כאן." /></DashboardShell>;
}
