import Link from "next/link";
import { Building2, Search, ShieldCheck, UserRoundPlus } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { EmptyState, StatusChip } from "@/components/gan-batuach-design-system";
import { AdminSectionIntro } from "@/components/platform-admin-ui";
import { adminBoundedRows, safeAdminData, logSupabaseError, type AdminReadState } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { createClient } from "@/lib/supabase/server";

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = { active: "פעיל", approved: "מאושר", pending: "ממתין", preliminary: "מקדים", suspended: "מושהה", blocked: "חסום", archived: "בארכיון" };
  return labels[String(value ?? "").toLowerCase()] ?? "דורש בדיקה";
}

function statusTone(value?: string | null): "success" | "warning" | "danger" | "muted" {
  if (["active", "approved"].includes(String(value))) return "success";
  if (["suspended", "blocked", "archived", "rejected"].includes(String(value))) return "danger";
  if (["pending", "preliminary"].includes(String(value))) return "warning";
  return "muted";
}

function countByGarden(rows: any[] | null | undefined) {
  return (rows ?? []).reduce((result: Record<string, number>, row: any) => {
    if (row.garden_id) result[row.garden_id] = (result[row.garden_id] ?? 0) + 1;
    return result;
  }, {});
}

export default async function AdminKindergartensPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { profile } = await requireRole(["admin"]);
  const params = await searchParams;
  const query = String(params.q ?? "").trim().toLocaleLowerCase("he");
  const status = String(params.status ?? "all");
  const result = await safeAdminData("גנים", async () => {
    const supabase = await createClient();
    const [gardensRes, childrenRes, staffRes, complaintsRes, documentsRes, subscriptionsRes] = await Promise.all([
      supabase.from("gardens" as any).select("id,name,city,address,children_capacity,current_children_count,staff_count,safe_status,status,approval_flow_status,owner_name,manager_id,owner_profile_id,created_at,managers:manager_id(full_name),owners:owner_profile_id(full_name)", { count: "exact" }).order("created_at", { ascending: false }).limit(500),
      supabase.from("children" as any).select("garden_id", { count: "exact" }).limit(2500),
      supabase.from("staff" as any).select("garden_id,approved_to_work", { count: "exact" }).limit(2000),
      supabase.from("complaints" as any).select("garden_id,status", { count: "exact" }).in("status", ["new", "assigned", "in_progress", "waiting_garden", "escalated"]).limit(1200),
      supabase.from("documents" as any).select("garden_id,status", { count: "exact" }).in("status", ["missing", "pending_review", "rejected", "expired"]).limit(2000),
      supabase.from("kindergarten_subscriptions" as any).select("garden_id,status,billing_status", { count: "exact" }).limit(600)
    ]);
    [gardensRes, childrenRes, staffRes, complaintsRes, documentsRes, subscriptionsRes].forEach((item, index) => logSupabaseError(`platform admin gardens ${index}`, item.error));
    const reads = {
      gardens: adminBoundedRows(gardensRes), children: adminBoundedRows(childrenRes), staff: adminBoundedRows(staffRes),
      complaints: adminBoundedRows(complaintsRes), documents: adminBoundedRows(documentsRes), subscriptions: adminBoundedRows(subscriptionsRes)
    };
    const sourceState = Object.fromEntries(Object.entries(reads).map(([key, value]) => [key, value.state])) as Record<keyof typeof reads, AdminReadState>;
    const sourceNames: Record<keyof typeof reads, string> = { gardens: "גנים", children: "ילדים", staff: "צוות", complaints: "תלונות", documents: "מסמכים", subscriptions: "מנויים" };
    const unavailable = (Object.entries(sourceState) as [keyof typeof reads, AdminReadState][]).filter(([, state]) => state !== "complete").map(([key, state]) => `${sourceNames[key]} ${state === "partial" ? "מוצגים חלקית" : "לא נטענו"}`);
    return { gardens: reads.gardens.rows as any[], children: countByGarden(reads.children.rows), staff: countByGarden(reads.staff.rows), complaints: countByGarden(reads.complaints.rows), documents: countByGarden(reads.documents.rows), subscriptions: new Map(reads.subscriptions.rows.map((item: any) => [item.garden_id, item])), sourceState, queryError: unavailable.length ? unavailable.join(" · ") : null };
  }, { gardens: [] as any[], children: {} as Record<string, number>, staff: {} as Record<string, number>, complaints: {} as Record<string, number>, documents: {} as Record<string, number>, subscriptions: new Map<string, any>(), sourceState: { gardens: "unavailable", children: "unavailable", staff: "unavailable", complaints: "unavailable", documents: "unavailable", subscriptions: "unavailable" } as Record<"gardens" | "children" | "staff" | "complaints" | "documents" | "subscriptions", AdminReadState>, queryError: null as string | null });

  const rows = result.data.gardens.filter((garden) => {
    const matchesStatus = status === "all" || [garden.status, garden.approval_flow_status].includes(status);
    const haystack = `${garden.name ?? ""} ${garden.city ?? ""} ${garden.owner_name ?? ""}`.toLocaleLowerCase("he");
    return matchesStatus && (!query || haystack.includes(query));
  });

  const ready = (source: keyof typeof result.data.sourceState) => !result.error && result.data.sourceState[source] === "complete";

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/kindergartens" title="ניהול גנים" subtitle="מחזור חיים, בעלות, מנוי ומוכנות שירות." badge={ready("gardens") ? `${rows.length} גנים` : "נתוני גנים חלקיים"}>
      <div className="platform-admin">
        <AdminSectionIntro eyebrow="GARDENS" title="מרכז הגנים" text="ניהול זהות הגן, אישור, מנוי ומצב שירות. הנתונים המוצגים כאן תפעוליים ומצרפיים ואינם כוללים תוכן פרטי של ילדים או משפחות." actions={<Link className="admin-primary-button" href="/dashboard/admin/users/new-kindergarten"><UserRoundPlus size={17} /> הוספת גן</Link>} />
        <AdminDataError message={result.error ?? result.data.queryError} />
        <form className="platform-admin-filter-bar" method="get" role="search" aria-label="חיפוש וסינון גנים">
          <Search size={20} aria-hidden="true" />
          <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="חיפוש לפי שם גן, עיר או בעלים" aria-label="חיפוש גנים" />
          <select name="status" defaultValue={status} aria-label="סינון לפי סטטוס"><option value="all">כל הסטטוסים</option><option value="active">פעיל</option><option value="pending">ממתין</option><option value="preliminary">מקדים</option><option value="suspended">מושהה</option></select>
          <button className="admin-primary-button" type="submit">הצגה</button>
        </form>
        {rows.length === 0 ? <EmptyState title={!ready("gardens") ? "רשימת הגנים אינה זמינה במלואה" : query || status !== "all" ? "לא נמצאו גנים למסנן" : "אין גנים להצגה"} text={!ready("gardens") ? "אפשר לנסות שוב מאוחר יותר; לא מוצגת רשימה ריקה כאילו זו תוצאה מאומתת." : "אפשר לשנות את החיפוש או לפתוח תהליך הקמת גן חדש."} icon={Building2} /> : (
          <section className="platform-admin-list" aria-label="רשימת גנים">
            {rows.map((garden) => {
              const subscription = result.data.subscriptions.get(garden.id) as any;
              return <article className="platform-admin-garden-card" key={garden.id}>
                <div><StatusChip tone={statusTone(garden.status ?? garden.approval_flow_status)}>{statusLabel(garden.status ?? garden.approval_flow_status)}</StatusChip><h2>{cleanSyntheticLabel(garden.name, "גן")}</h2><p>{garden.city ?? "עיר לא צוינה"} · {garden.address ?? "כתובת לא הוזנה"}</p><small>בעלות: {garden.owners?.full_name ?? garden.owner_name ?? "טרם שויכה"} · מנהלת: {garden.managers?.full_name ?? "טרם שויכה"}</small></div>
                <div className="platform-admin-card-facts" aria-label="סיכום גן"><span><small>ילדים רשומים</small><b>{ready("children") ? result.data.children[garden.id] ?? 0 : "לא נמדד"}/{garden.children_capacity ?? "—"}</b></span><span><small>צוות</small><b>{ready("staff") ? result.data.staff[garden.id] ?? 0 : "לא נמדד"}</b></span><span><small>פעולות פתוחות</small><b>{ready("complaints") && ready("documents") ? (result.data.complaints[garden.id] ?? 0) + (result.data.documents[garden.id] ?? 0) : "לא נמדד"}</b></span><span><small>מנוי פלטפורמה</small><b>{ready("subscriptions") ? subscription ? statusLabel(subscription.status ?? subscription.billing_status) : "לא הוגדר" : "לא נמדד"}</b></span></div>
                <div className="platform-admin-card-actions"><Link href={`/dashboard/admin/gardens/${garden.id}`}>פרטי גן</Link><Link href={`/dashboard/admin/kindergarten-applications?garden=${garden.id}`}><ShieldCheck size={15} /> אישור ומוכנות</Link></div>
              </article>;
            })}
          </section>
        )}
      </div>
    </AdminAppFrame>
  );
}
