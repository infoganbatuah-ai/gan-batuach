import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

function like(term: string) {
  return `%${term.replace(/[%_]/g, "")}%`;
}

export async function GET(request: Request) {
  try {
    await requireRole(["admin"]);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) return ok([]);
    const supabase = await createClient();
    const pattern = like(q);
    const [gardens, profiles, children, parents, tasks, inspections, documents, complaints] = await Promise.all([
      supabase.from("gardens" as any).select("id, name, city").or(`name.ilike.${pattern},city.ilike.${pattern}`).limit(8),
      supabase.from("profiles" as any).select("id, full_name, role, email").or(`full_name.ilike.${pattern},email.ilike.${pattern},username.ilike.${pattern}`).limit(8),
      supabase.from("children" as any).select("id, full_name, garden_id").ilike("full_name", pattern).limit(8),
      supabase.from("parents" as any).select("id, full_name, garden_id, phone").or(`full_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`).limit(8),
      supabase.from("tasks" as any).select("id, title, status, garden_id").ilike("title", pattern).limit(8),
      supabase.from("inspections" as any).select("id, garden_id, status, weighted_score").limit(5),
      supabase.from("documents" as any).select("id, name, document_type, garden_id").or(`name.ilike.${pattern},document_type.ilike.${pattern}`).limit(8),
      supabase.from("complaints" as any).select("id, subject, severity, status, garden_id").ilike("subject", pattern).limit(8)
    ]);
    const errors = [gardens, profiles, children, parents, tasks, inspections, documents, complaints].map((res) => res.error).filter(Boolean);
    if (errors.length) {
      console.error("[admin-search]", errors);
      return fail("לא ניתן לבצע חיפוש כרגע", 400);
    }
    return ok([
      ...(gardens.data ?? []).map((item: any) => ({ type: "גן", title: item.name, subtitle: item.city, href: `/dashboard/admin/gardens/${item.id}` })),
      ...(profiles.data ?? []).map((item: any) => ({ type: "משתמש", title: item.full_name ?? item.email, subtitle: item.role, href: "/dashboard/admin/users" })),
      ...(children.data ?? []).map((item: any) => ({ type: "ילד", title: item.full_name, subtitle: item.garden_id, href: `/dashboard/admin/gardens/${item.garden_id}` })),
      ...(parents.data ?? []).map((item: any) => ({ type: "הורה", title: item.full_name, subtitle: item.phone, href: "/dashboard/admin/users" })),
      ...(tasks.data ?? []).map((item: any) => ({ type: "משימה", title: item.title, subtitle: item.status, href: "/dashboard/admin/tasks" })),
      ...(inspections.data ?? []).map((item: any) => ({ type: "ביקורת", title: `ציון ${item.weighted_score ?? "-"}`, subtitle: item.status, href: "/dashboard/admin/inspection-forms" })),
      ...(documents.data ?? []).map((item: any) => ({ type: "מסמך", title: item.name, subtitle: item.document_type, href: "/dashboard/admin/documents" })),
      ...(complaints.data ?? []).map((item: any) => ({ type: "פנייה", title: item.subject, subtitle: item.status, href: "/dashboard/admin/complaints" }))
    ]);
  } catch (error) {
    return handleRouteError(error);
  }
}
