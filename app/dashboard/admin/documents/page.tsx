import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError, AdminEmptyState } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminListPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("מסמכים", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, file_url, gardens(name), children(full_name), staff(full_name)").order("expires_at", { ascending: true }).limit(100);
    logSupabaseError("מסמכים", error);
    return { rows: (data ?? []) as any[], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows;
  const expiringSoon = rows.filter((row) => row.expires_at && new Date(row.expires_at).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000).length;
  return <DashboardShell role="admin" title="מסמכים"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Document Center</p><h1>מרכז מסמכים מלא.</h1><p>ילדים, הורים, צוות, גנים ומפקחים: סוג מסמך, תוקף, סטטוס, חסרים, עומדים לפוג ואישור אדמין.</p></div><span className={expiringSoon ? "pill warn" : "pill good"}>{expiringSoon} עומדים לפוג</span></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="dashboard-section">{rows.length === 0 ? <AdminEmptyState /> : <div className="document-center-grid">{rows.map((row) => <article className="card document-card" key={row.id ?? JSON.stringify(row)}><div><span className={row.status === "approved" ? "pill good" : row.status === "rejected" ? "pill bad" : "pill warn"}>{row.status ?? "pending_review"}</span><h3>{row.name ?? "מסמך"}</h3><p>{row.document_type ?? ""}</p><small>{row.gardens?.name ?? row.children?.full_name ?? row.staff?.full_name ?? "ישות כללית"} · תוקף {row.expires_at ? new Date(row.expires_at).toLocaleDateString("he-IL") : "לא הוגדר"}</small></div><div className="actions"><a className="button secondary tiny" href={row.file_url ?? "#"}>צפייה</a><button className="button tiny" type="button">אישור</button><button className="button tiny" type="button">דחייה</button></div></article>)}</div>}</section></DashboardShell>;
}
