import Link from "next/link";
import { Download, FileSpreadsheet, TrendingUp, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function money(value: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

export default async function GardenFinancePage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, historyRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, monthly_fee, payment_status, last_payment_date, next_payment_due, valid_until, payment_notes").eq("garden_id", gardenId).order("full_name"),
    supabase.from("child_payment_history" as any).select("id, child_id, amount, action, payment_status, paid_at, valid_until, notes, children(full_name)").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(40)
  ]);
  const children = (childrenRes.data ?? []) as any[];
  const history = (historyRes.data ?? []) as any[];
  const expected = children.reduce((sum, child) => sum + Number(child.monthly_fee ?? 0), 0);
  const paid = children.filter((child) => child.payment_status === "paid").reduce((sum, child) => sum + Number(child.monthly_fee ?? 0), 0);
  const missing = Math.max(0, expected - paid);
  const overdue = children.filter((child) => child.payment_status === "overdue" || (child.next_payment_due && new Date(child.next_payment_due).getTime() < Date.now())).length;
  const discounts = children.filter((child) => child.payment_status === "discount" || child.payment_status === "special_arrangement").length;
  const collection = expected ? Math.round((paid / expected) * 100) : 0;
  const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מרכז כספים">
      <div className="dashboard-hero-card garden-hero-card finance-hero-card">
        <div><p className="eyebrow">Kindergarten Finance</p><h1>מרכז גבייה ותשלומי ילדים.</h1><p>הכנסות חודשיות, תשלומים חסרים, איחורים, הנחות והסדרים מיוחדים במקום אחד.</p></div>
        <span className={overdue ? "pill bad" : "pill good"}><WalletCards size={15} /> גבייה {collection}%</span>
      </div>
      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="הכנסה חודשית צפויה" value={money(expected)} tone="good" />
        <StatCard label="נגבה החודש" value={money(paid)} tone="good" />
        <StatCard label="חסר לגבייה" value={money(missing)} tone={missing ? "warn" : "good"} />
        <StatCard label="תשלומים באיחור" value={overdue} tone={overdue ? "bad" : "good"} />
      </div>
      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><div className="section-heading"><h2><TrendingUp size={20} /> גרף חודשי</h2><p>המחשה מהירה של יעד מול גבייה. נתוני אמת יתווספו לפי היסטוריית התשלומים.</p></div><div className="finance-chart">{months.slice(0, 6).map((month, index) => <div key={month}><span>{month}</span><i><b style={{ height: `${Math.max(12, Math.min(100, collection - index * 4 + 12))}%` }} /></i></div>)}</div></article>
        <article className="card action-panel"><h2>Reports</h2><p>ייצוא דוחות גבייה, איחורים וסיכום הכנסה. כפתורי הייצוא מכינים דוח דפדפן להדפסה/שמירה.</p><div className="profile-actions"><button className="button secondary" type="button"><Download size={15} /> PDF</button><button className="button secondary" type="button"><FileSpreadsheet size={15} /> Excel</button><Link className="button" href="/dashboard/garden/children">כרטיסי ילדים</Link></div><div className="quick-history-cards"><span>הנחות <b>{discounts}</b></span><span>איחורים <b>{overdue}</b></span><span>גבייה <b>{collection}%</b></span></div></article>
      </section>
      <section className="dashboard-section"><div className="section-heading"><h2>תשלומי ילדים</h2><p>סטטוס לפי ילד, תוקף תשלום ותאריך יעד הבא.</p></div>{children.length === 0 ? <div className="empty-state"><strong>אין ילדים לתצוגת כספים</strong><span>לאחר הוספת ילדים, ניתן להגדיר סכום חודשי ולעקוב אחרי תשלומים.</span><Link className="button primary" href="/dashboard/garden/children">מעבר לילדים</Link></div> : <div className="people-card-grid">{children.map((child) => <article className="person-card finance-student-card" key={child.id}><div><span className={child.payment_status === "paid" ? "pill good" : child.payment_status === "overdue" ? "pill bad" : "pill warn"}>{child.payment_status ?? "unconfigured"}</span><h3>{child.full_name}</h3><p>סכום חודשי: {money(Number(child.monthly_fee ?? 0))}</p></div><div className="mini-kpi-row"><span>שולם <b>{child.last_payment_date ? new Date(child.last_payment_date).toLocaleDateString("he-IL") : "-"}</b></span><span>תוקף עד <b>{child.valid_until ? new Date(child.valid_until).toLocaleDateString("he-IL") : "-"}</b></span><span>יעד הבא <b>{child.next_payment_due ? new Date(child.next_payment_due).toLocaleDateString("he-IL") : "-"}</b></span></div></article>)}</div>}</section>
      <section className="dashboard-section"><div className="section-heading"><h2>היסטוריית תשלומים</h2><p>פעולות תשלום אחרונות, כולל הנחות והסדרים מיוחדים.</p></div>{history.length === 0 ? <div className="empty-state"><strong>אין היסטוריית תשלומים עדיין</strong><span>כאשר תסמנו ילד כשולם/לא שולם/הסדר מיוחד, ההיסטוריה תופיע כאן.</span></div> : <div className="procedure-list">{history.map((item) => <article className="card procedure-card" key={item.id}><div><span className="pill">{item.payment_status}</span><h3>{item.children?.full_name ?? item.child_id}</h3><p>{money(Number(item.amount ?? 0))} · {item.action}</p><small>{item.paid_at ? new Date(item.paid_at).toLocaleDateString("he-IL") : ""} · תוקף {item.valid_until ? new Date(item.valid_until).toLocaleDateString("he-IL") : "-"}</small></div></article>)}</div>}</section>
    </DashboardShell>
  );
}
