import { Bell, UserRoundPlus } from "lucide-react";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenChildTransferRequestsPanel } from "@/components/garden-child-transfer-requests-panel";
import { GardenParentLeadsCenter } from "@/components/garden-parent-leads-center";
import { StatCard } from "@/components/stat-card";
import { PremiumDashboardHero } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const leadFilterLabels: Record<string, string> = {
  new: "בקשות חדשות שממתינות להמרה",
  pending: "בקשות שממתינות לטיפול",
  completion: "הורים פעילים שממתינים להשלמת פרטי ילד",
  missing: "בקשות שחסרים בהן פרטים",
  converted: "בקשות שכבר הומרו"
};

function filterLeads(leads: any[], status?: string) {
  if (!status) return leads;
  if (status === "new") return leads.filter((lead) => ["new", "new_parent_lead", "viewed"].includes(String(lead.status)));
  if (status === "pending") return leads.filter((lead) => ["new", "new_parent_lead", "viewed", "missing_details"].includes(String(lead.status)));
  if (status === "completion") return leads.filter((lead) => ["parent_approved_pending_child_completion", "approved_pending_parent_completion"].includes(String(lead.status)));
  if (status === "missing") return leads.filter((lead) => lead.status === "missing_details");
  if (status === "converted") return leads.filter((lead) => ["parent_approved_pending_child_completion", "approved_pending_parent_completion", "active", "converted"].includes(String(lead.status)));
  return leads;
}

export default async function GardenLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const { data } = await supabase
    .from("leads" as any)
    .select("id, garden_id, lead_type, parent_name, parent_identity_number, phone, email, child_name, child_identity_number, child_age, requested_age_group, requested_start_date, address, notes, status, source, missing_details, converted_parent_id, converted_child_id, converted_at, created_at, gardens(name, city)")
    .eq("garden_id", gardenId)
    .eq("lead_type", "parent")
    .order("created_at", { ascending: false });

  const leads = (data ?? []) as any[];
  const visibleLeads = filterLeads(leads, params.status);
  const [incomingTransfersRes, outgoingTransfersRes] = await Promise.all([
    supabase.from("child_transfer_requests" as any).select("*").eq("target_garden_id", gardenId).order("created_at", { ascending: false }),
    supabase.from("child_transfer_requests" as any).select("*").eq("current_garden_id", gardenId).order("created_at", { ascending: false })
  ]);
  const transferRows = [...((incomingTransfersRes.data ?? []) as any[]), ...((outgoingTransfersRes.data ?? []) as any[])];
  const childIds = Array.from(new Set(transferRows.flatMap((row) => [row.child_id, row.target_child_id]).filter(Boolean)));
  const fileIds = Array.from(new Set(transferRows.map((row) => row.permanent_child_file_id).filter(Boolean)));
  const parentIds = Array.from(new Set(transferRows.map((row) => row.parent_id).filter(Boolean)));
  const transferGardenIds = Array.from(new Set(transferRows.flatMap((row) => [row.current_garden_id, row.target_garden_id]).filter(Boolean)));
  const [transferChildrenRes, transferFilesRes, transferParentsRes, transferGardensRes] = await Promise.all([
    childIds.length ? supabase.from("children" as any).select("id, full_name, birth_date, photo_url, face_image_url, allergies, medical_notes, emergency_phone, pickup_authorized").in("id", childIds) : { data: [] },
    fileIds.length ? supabase.from("permanent_child_files" as any).select("id, full_name, birth_date, photo_url, face_image_url, allergies, medical_notes, emergency_phone, pickup_authorized").in("id", fileIds) : { data: [] },
    parentIds.length ? supabase.from("parents" as any).select("id, full_name, phone, email").in("id", parentIds) : { data: [] },
    transferGardenIds.length ? supabase.from("gardens" as any).select("id, name, city").in("id", transferGardenIds) : { data: [] }
  ]);
  const childrenById = new Map(((transferChildrenRes.data ?? []) as any[]).map((row) => [row.id, row]));
  const filesById = new Map(((transferFilesRes.data ?? []) as any[]).map((row) => [row.id, row]));
  const parentsById = new Map(((transferParentsRes.data ?? []) as any[]).map((row) => [row.id, row]));
  const gardensById = new Map(((transferGardensRes.data ?? []) as any[]).map((row) => [row.id, row]));
  const hydrateTransfer = (row: any) => ({
    ...row,
    child: row.child_id ? childrenById.get(row.child_id) : null,
    target_child: row.target_child_id ? childrenById.get(row.target_child_id) : null,
    permanent_child_files: row.permanent_child_file_id ? filesById.get(row.permanent_child_file_id) : null,
    parent: row.parent_id ? parentsById.get(row.parent_id) : null,
    current_garden: row.current_garden_id ? gardensById.get(row.current_garden_id) : null,
    target_garden: row.target_garden_id ? gardensById.get(row.target_garden_id) : null
  });
  const incomingTransfers = ((incomingTransfersRes.data ?? []) as any[]).map(hydrateTransfer);
  const outgoingTransfers = ((outgoingTransfersRes.data ?? []) as any[]).map(hydrateTransfer);
  const newCount = leads.filter((lead) => ["new", "new_parent_lead"].includes(lead.status)).length;
  const pendingCompletion = leads.filter((lead) => ["parent_approved_pending_child_completion", "approved_pending_parent_completion"].includes(String(lead.status))).length;
  const missing = leads.filter((lead) => lead.status === "missing_details").length;
  const transferCount = incomingTransfers.length + outgoingTransfers.length;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="לידים / בקשות הצטרפות">
      <PremiumDashboardHero eyebrow="בקשות הצטרפות" title="הורים חדשים במקום מסודר." subtitle="בודקים בקשה, מאשרים, וההורה משלים את פרטי הילד." badge={<><Bell size={15} /> {newCount} חדשים</>} badgeTone={newCount ? "warn" : "good"} />

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="לידים חדשים" value={newCount} tone={newCount ? "warn" : "good"} href="/dashboard/garden/leads?status=new" />
        <StatCard label="ממתינים להשלמת הורה" value={pendingCompletion} tone={pendingCompletion ? "warn" : "good"} href="/dashboard/garden/leads?status=completion" />
        <StatCard label="חסרים פרטים" value={missing} tone={missing ? "bad" : "good"} href="/dashboard/garden/leads?status=missing" />
        <StatCard label="בקשות מעבר/קליטה" value={transferCount} tone={transferCount ? "warn" : "good"} />
        <StatCard label="סה״כ בקשות" value={leads.length} />
      </div>
      <DashboardFilterChip
        label={leadFilterLabels[params.status ?? ""]}
        clearHref="/dashboard/garden/leads"
        isEmpty={visibleLeads.length === 0}
        emptyTitle={params.status === "new" ? "אין כרגע לידים חדשים" : params.status ? `אין כרגע ${leadFilterLabels[params.status]}` : undefined}
        emptyText="כל הבקשות במסנן הזה כבר טופלו או עברו לשלב הבא."
      />

      <section className="card action-panel">
        <UserRoundPlus />
        <h2>איך זה עובד?</h2>
        <p>מאשרים בקשה, ההורה משלים פרטים, ואז המנהלת מאשרת את הילד לגן.</p>
      </section>

      <GardenChildTransferRequestsPanel incoming={incomingTransfers} outgoing={outgoingTransfers} />

      <GardenParentLeadsCenter leads={visibleLeads} />
    </DashboardShell>
  );
}
