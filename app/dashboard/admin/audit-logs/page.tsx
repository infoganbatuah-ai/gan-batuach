import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAuditLogsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("audit logs", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("audit_logs" as any).select("*, actor:actor_id(full_name, role), gardens(name, city)").order("created_at", { ascending: false }).limit(250);
    logSupabaseError("audit logs", error);
    return { rows: (data ?? []) as any[], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows;
  return <DashboardShell role="admin" title="Audit Logs"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Audit Trail</p><h1>לוג פעולות מערכת.</h1><p>משתמש, תפקיד, פעולה, ישות, גן, זמן ומטא־דאטה לצורך בקרה פנימית.</p></div><span className="pill good">{rows.length} פעולות</span></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="filter-bar"><input placeholder="סינון לפי פעולה / משתמש / גן" /><select><option>כל התפקידים</option><option>admin</option><option>manager</option><option>owner</option><option>inspector</option><option>staff</option><option>parent</option></select><input type="date" /></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין לוגים להצגה</strong><span>פעולות יצירה, עדכון, אישור, השבתה ו־override יופיעו כאן.</span></div> : <div className="procedure-list">{rows.map((log) => <article className="card procedure-card" key={log.id}><div><span className="pill">{log.actor_role ?? log.actor?.role ?? "system"}</span><h3>{log.action}</h3><p>{log.entity_type} · {log.entity_id}</p><small>{log.actor?.full_name ?? log.actor_id ?? "-"} · {log.gardens?.name ?? log.garden_id ?? "ללא גן"} · {log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : ""}</small></div><div className="procedure-meta"><span className="pill">IP {log.ip ?? "-"}</span><details><summary>metadata</summary><pre>{JSON.stringify(log.after_data ?? log.metadata ?? {}, null, 2)}</pre></details></div></article>)}</div>}</section></DashboardShell>;
}
