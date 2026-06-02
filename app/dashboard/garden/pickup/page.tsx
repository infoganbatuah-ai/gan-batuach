import { MapPinned, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Avatar } from "@/components/avatar";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenPickupPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, pickupRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, pickup_authorized").eq("garden_id", gardenId).order("full_name"),
    supabase.from("pickup_confirmations" as any).select("*, children(full_name, photo_url)").eq("garden_id", gardenId).order("confirmed_at", { ascending: false }).limit(80)
  ]);
  const pickedChildIds = new Set(((pickupRes.data ?? []) as any[]).map((row) => row.child_id).filter(Boolean));
  const children = params.filter === "pending" ? ((childrenRes.data ?? []) as any[]).filter((child) => !pickedChildIds.has(child.id)) : ((childrenRes.data ?? []) as any[]);
  const pickups = params.filter === "pending" ? [] : ((pickupRes.data ?? []) as any[]);
  return (
    <DashboardShell role="manager" title="איסוף והחזרה">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Pickup & Dropoff</p><h1>מי אסף, מתי, מאיפה והאם הוא מורשה.</h1><p>לוג GPS, אישור הורה, אישור צוות, איחור באיסוף והתראה על איסוף לא מורשה.</p></div><span className="pill good"><MapPinned size={15} /> לוג מיקום וזמן</span></div>
      <DashboardFilterChip label={params.filter === "pending" ? "איסופים שלא הושלמו" : null} clearHref="/dashboard/garden/pickup" isEmpty={children.length === 0} emptyTitle="אין כרגע איסופים שלא הושלמו" emptyText="כל הילדים במסנן הזה נאספו או שאין ילדים פעילים להצגה." />
      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><div className="section-heading"><h2>{params.filter === "pending" ? "ילדים שממתינים לאיסוף" : "מורשי איסוף לפי ילד"}</h2><p>רשימה זו מתעדכנת מכרטיס הילד שההורה מילא והמנהלת אישרה.</p></div>{children.length === 0 ? <div className="empty-state"><strong>{params.filter === "pending" ? "אין כרגע ילדים שממתינים לאיסוף" : "אין ילדים להצגה"}</strong><span>{params.filter === "pending" ? "כל הילדים במסנן הזה נאספו." : "ילדים פעילים יופיעו כאן עם מורשי איסוף."}</span></div> : <div className="child-card-list">{children.map((child: any) => <div className="child-card" key={child.id}><Avatar name={child.full_name} src={child.photo_url} /><span><strong>{child.full_name}</strong><small>{Array.isArray(child.pickup_authorized) && child.pickup_authorized.length ? child.pickup_authorized.map((person: any) => person.name ?? person).join(", ") : "לא הוגדרו מורשי איסוף"}</small></span></div>)}</div>}</article>
        <article className="card action-panel"><div className="section-heading"><h2>איסופים אחרונים</h2><p>כל אישור כולל זמן, מיקום, שם האוסף וסטטוס הרשאה.</p></div>{pickups.length === 0 ? <div className="empty-state"><strong>{params.filter === "pending" ? "מציגים כרגע רק איסופים שלא הושלמו" : "אין איסופים היום"}</strong><span>{params.filter === "pending" ? "נקו סינון כדי לראות איסופים אחרונים." : "כאשר הורה או צוות יאשר איסוף, הוא יופיע כאן בזמן אמת."}</span></div> : <div className="timeline-list">{pickups.map((row: any) => <div className="timeline-item" key={row.id}><span className={row.authorized ? "severity-dot low" : "severity-dot critical"} /> <div><strong>{row.children?.full_name ?? "ילד/ה"} נאסף/ה על ידי {row.picked_up_by_name}</strong><small>{new Date(row.confirmed_at).toLocaleString("he-IL")} · GPS {row.gps_lat ?? "-"}, {row.gps_lng ?? "-"}</small>{!row.authorized ? <p className="danger-text"><ShieldAlert size={14} /> אזהרה: האוסף אינו מסומן כמורשה.</p> : null}</div></div>)}</div>}</article>
      </section>
    </DashboardShell>
  );
}
