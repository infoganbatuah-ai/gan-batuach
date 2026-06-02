import { MapPinned } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { GardenPickupVerificationPanel } from "@/components/pickup-verification-panels";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenPickupPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [childrenRes, contactsRes, eventsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, pickup_authorized").eq("garden_id", gardenId).order("full_name"),
    supabase.from("authorized_pickup_contacts" as any).select("*, children(full_name, photo_url)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(300),
    supabase.from("child_pickup_events" as any).select("*, children(full_name, photo_url)").eq("kindergarten_id", gardenId).order("pickup_time", { ascending: false }).limit(100)
  ]);
  const pickedChildIds = new Set(((eventsRes.data ?? []) as any[]).map((row) => row.child_id).filter(Boolean));
  const children = params.filter === "pending" ? ((childrenRes.data ?? []) as any[]).filter((child) => !pickedChildIds.has(child.id)) : ((childrenRes.data ?? []) as any[]);
  const contacts = (contactsRes.data ?? []) as any[];
  const events = params.filter === "pending" ? [] : ((eventsRes.data ?? []) as any[]);
  return (
    <DashboardShell role="manager" title="איסוף והחזרה">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Pickup Verification</p><h1>מי רשאי לאסוף ומי נאסף בפועל.</h1><p>הרשאות איסוף קבועות וזמניות, רישום איסוף, אירוע חריג ובקשת אישור הורה. אין שחרור אוטומטי.</p></div><span className="pill good"><MapPinned size={15} /> בדיקה אנושית</span></div>
      <DashboardFilterChip label={params.filter === "pending" ? "איסופים שלא הושלמו" : null} clearHref="/dashboard/garden/pickup" isEmpty={children.length === 0} emptyTitle="אין כרגע איסופים שלא הושלמו" emptyText="כל הילדים במסנן הזה נאספו או שאין ילדים פעילים להצגה." />
      <GardenPickupVerificationPanel children={children} contacts={contacts} events={events} />
    </DashboardShell>
  );
}
