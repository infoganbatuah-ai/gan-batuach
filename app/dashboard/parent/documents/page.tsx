import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

export default async function ParentDocumentsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const childIds = (family.children as any[]).map((child) => child.id).filter(Boolean);
  const parentIds = family.parentIds.filter(Boolean);
  const gardenIds = family.gardenIds.filter(Boolean);
  const filters = [
    childIds.length ? `child_id.in.(${childIds.join(",")})` : "",
    parentIds.length ? `parent_id.in.(${parentIds.join(",")})` : "",
    gardenIds.length ? `garden_id.in.(${gardenIds.join(",")})` : ""
  ].filter(Boolean);
  const docsRes = filters.length
    ? await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at, child_id, garden_id").or(filters.join(",")).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (docsRes.error) console.error("[parent-documents] query failed", { profile_id: profile.id, error: docsRes.error.message });
  return <DashboardShell role="parent" title="מסמכים"><ModuleListPage title="מסמכים ואישורים להורה" eyebrow="Documents" description="אישורי פרטיות, בריאות, צילום, מצלמות ומסמכים שהגן שיתף עם המשפחה." rows={(docsRes.data ?? []) as any[]} emptyTitle="אין מסמכים נדרשים כרגע" emptyText="אם הגן יבקש מסמך או יאשר מסמך שהועלה, הוא יופיע כאן עם סטטוס ברור." /></DashboardShell>;
}
