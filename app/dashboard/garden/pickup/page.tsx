import { MapPinned, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Avatar } from "@/components/avatar";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenPickupPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, pickupRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, pickup_authorized").eq("garden_id", gardenId).order("full_name"),
    supabase.from("pickup_confirmations" as any).select("*, children(full_name, photo_url)").eq("garden_id", gardenId).order("confirmed_at", { ascending: false }).limit(80)
  ]);
  return (
    <DashboardShell role="manager" title="איסוף והחזרה">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Pickup & Dropoff</p><h1>מי אסף, מתי, מאיפה והאם הוא מורשה.</h1><p>לוג GPS, אישור הורה, אישור צוות, איחור באיסוף והתראה על איסוף לא מורשה.</p></div><span className="pill good"><MapPinned size={15} /> לוג מיקום וזמן</span></div>
      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><div className="section-heading"><h2>מורשי איסוף לפי ילד</h2><p>רשימה זו מתעדכנת מכרטיס הילד שההורה מילא והמנהלת אישרה.</p></div>{(childrenRes.data ?? []).length === 0 ? <div className="empty-state"><strong>אין ילדים להצגה</strong><span>ילדים פעילים יופיעו כאן עם מורשי איסוף.</span></div> : <div className="child-card-list">{(childrenRes.data ?? []).map((child: any) => <div className="child-card" key={child.id}><Avatar name={child.full_name} src={child.photo_url} /><span><strong>{child.full_name}</strong><small>{Array.isArray(child.pickup_authorized) && child.pickup_authorized.length ? child.pickup_authorized.map((person: any) => person.name ?? person).join(", ") : "לא הוגדרו מורשי איסוף"}</small></span></div>)}</div>}</article>
        <article className="card action-panel"><div className="section-heading"><h2>איסופים אחרונים</h2><p>כל אישור כולל זמן, מיקום, שם האוסף וסטטוס הרשאה.</p></div>{(pickupRes.data ?? []).length === 0 ? <div className="empty-state"><strong>אין איסופים היום</strong><span>כאשר הורה או צוות יאשר איסוף, הוא יופיע כאן בזמן אמת.</span></div> : <div className="timeline-list">{(pickupRes.data ?? []).map((row: any) => <div className="timeline-item" key={row.id}><span className={row.authorized ? "severity-dot low" : "severity-dot critical"} /> <div><strong>{row.children?.full_name ?? "ילד/ה"} נאסף/ה על ידי {row.picked_up_by_name}</strong><small>{new Date(row.confirmed_at).toLocaleString("he-IL")} · GPS {row.gps_lat ?? "-"}, {row.gps_lng ?? "-"}</small>{!row.authorized ? <p className="danger-text"><ShieldAlert size={14} /> אזהרה: האוסף אינו מסומן כמורשה.</p> : null}</div></div>)}</div>}</article>
      </section>
    </DashboardShell>
  );
}
