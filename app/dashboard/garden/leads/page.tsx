import { Bell, UserRoundPlus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenChildTransferRequestsPanel } from "@/components/garden-child-transfer-requests-panel";
import { GardenParentLeadsCenter } from "@/components/garden-parent-leads-center";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenLeadsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const { data } = await supabase
    .from("leads" as any)
    .select("id, garden_id, lead_type, parent_name, phone, email, child_name, child_age, notes, status, source, missing_details, converted_parent_id, converted_child_id, converted_at, created_at, gardens(name, city)")
    .eq("garden_id", gardenId)
    .eq("lead_type", "parent")
    .order("created_at", { ascending: false });

  const leads = (data ?? []) as any[];
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
  const pendingCompletion = leads.filter((lead) => lead.status === "approved_pending_parent_completion").length;
  const missing = leads.filter((lead) => lead.status === "missing_details").length;
  const transferCount = incomingTransfers.length + outgoingTransfers.length;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="לידים / בקשות הצטרפות">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">Parent Leads</p>
          <h1>בקשות רישום שמגיעות ישירות מהעמוד הציבורי של הגן.</h1>
          <p>כל בקשה נשמרת, נשלחת כהתראה למנהלת/בעלים, וניתנת להמרה להורה פעיל עם כרטיס ילד להשלמת פרטים.</p>
        </div>
        <span className={newCount ? "pill warn" : "pill good"}><Bell size={15} /> {newCount} חדשים</span>
      </div>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="לידים חדשים" value={newCount} tone={newCount ? "warn" : "good"} />
        <StatCard label="ממתינים להשלמת הורה" value={pendingCompletion} tone={pendingCompletion ? "warn" : "good"} />
        <StatCard label="חסרים פרטים" value={missing} tone={missing ? "bad" : "good"} />
        <StatCard label="בקשות מעבר/קליטה" value={transferCount} tone={transferCount ? "warn" : "good"} />
        <StatCard label="סה״כ בקשות" value={leads.length} />
      </div>

      <section className="card action-panel">
        <UserRoundPlus />
        <h2>איך הזרימה עובדת?</h2>
        <p>המרה יוצרת משתמש הורה וכרטיס ילד במצב `pending_parent_completion`. רק אחרי שההורה משלים פרטים והמנהלת מאשרת, הילד הופך לפעיל ברשימת הילדים.</p>
      </section>

      <GardenChildTransferRequestsPanel incoming={incomingTransfers} outgoing={outgoingTransfers} />

      <GardenParentLeadsCenter leads={leads} />
    </DashboardShell>
  );
}
