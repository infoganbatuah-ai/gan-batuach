import { Megaphone, Siren, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin notices", async () => {
    const supabase = await createClient();
    const query = async <T,>(label: string, load: () => PromiseLike<{ data: T | null; error: unknown }>) => {
      try {
        const { data, error } = await load();
        logSupabaseError(label, error);
        return { data: error ? null : data, available: !error };
      } catch (error) {
        logSupabaseError(label, error);
        return { data: null, available: false };
      }
    };
    const [campaigns, notifications] = await Promise.all([
      query("admin notices campaigns", () => supabase.from("campaigns" as any).select("id, title, body, audience, starts_at, ends_at, created_at").order("created_at", { ascending: false }).limit(30)),
      query("admin notices notifications", () => supabase.from("notifications" as any).select("id, title, body, recipient_role, status, severity, scheduled_for, sent_at, read_at").order("created_at", { ascending: false }).limit(50))
    ]);
    return { campaigns: campaigns.data ?? [], notifications: notifications.data ?? [], campaignsAvailable: campaigns.available, notificationsAvailable: notifications.available, queryError: !campaigns.available || !notifications.available ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { campaigns: [] as any[], notifications: [] as any[], campaignsAvailable: false, notificationsAvailable: false, queryError: null as string | null });
  const campaigns = result.data.campaigns as any[];
  const notifications = result.data.notifications as any[];
  return <DashboardShell role="admin" title="הודעות וקמפיינים"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">הודעות מערכת</p><h1>פרסום הודעות, קמפיינים והתראות חירום.</h1><p>שליחת הודעות לפי תפקיד, גן או כלל המערכת. ההודעות נשמרות במרכז ההתראות עם סטטוס קריאה.</p></div><span className={result.data.notificationsAvailable ? "pill good" : "pill"}>{result.data.notificationsAvailable ? <>{notifications.length} התראות אחרונות</> : "נתוני ההתראות אינם זמינים"}</span></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="grid cols-3 dashboard-panels"><article className="card action-panel"><Megaphone /><h2>הודעה ארצית</h2><p>פרסום לכל מנהלות, פקחים, צוות או הורים לפי קהל יעד.</p><span className="pill">דרך API מאובטח</span></article><article className="card action-panel"><Siren /><h2>התראת חירום</h2><p>יצירת הודעה דחופה שיכולה להפוך למשימה לביצוע.</p><span className="pill bad">גבוה</span></article><article className="card action-panel"><Users /><h2>קהלים</h2><p>admin, inspector, manager, owner, staff, parent.</p><span className="pill">RBAC</span></article></section><section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>קמפיינים</h2>{!result.data.campaignsAvailable ? <div className="empty-state"><strong>נתוני הקמפיינים אינם זמינים כרגע</strong><span>לא ניתן לקבוע את מצב הקמפיינים עד לטעינת הנתונים.</span></div> : campaigns.length === 0 ? <div className="empty-state"><strong>אין קמפיינים פעילים</strong><span>כאשר אדמין ייצור הודעה רחבה או קמפיין הסברה, הוא יופיע כאן עם קהל היעד וזמני הפרסום.</span></div> : <div className="procedure-list">{campaigns.map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.starts_at ? new Date(item.starts_at).toLocaleString("he-IL") : ""}</span></div><span className="pill">קמפיין</span></div>)}</div>}</article><article className="card action-panel"><h2>התראות אחרונות</h2>{!result.data.notificationsAvailable ? <div className="empty-state"><strong>נתוני ההתראות אינם זמינים כרגע</strong><span>לא ניתן לקבוע את מצב ההתראות עד לטעינת הנתונים.</span></div> : notifications.length === 0 ? <div className="empty-state"><strong>אין התראות שנשלחו</strong><span>התראות מערכת, משימות חירום והודעות אדמין יוצגו כאן עם סטטוס שליחה וקריאה.</span></div> : <div className="procedure-list">{notifications.map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.recipient_role ?? "כללי"} · {item.scheduled_for ? new Date(item.scheduled_for).toLocaleString("he-IL") : ""}</span></div><span className="pill">{item.status}</span></div>)}</div>}</article></section></DashboardShell>;
}
