import { DashboardShell } from "@/components/dashboard-shell";
import { StaffDocumentUpload } from "@/components/staff-document-upload";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffDocumentsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const staffId = (staffRes.data as any)?.id ?? "";
  const { data } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at, file_url").eq("staff_id", staffId).order("created_at", { ascending: false });
  return (
    <DashboardShell role="staff" title="מסמכים">
      <div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">Staff Documents</p><h1>מסמכי עובד ותעודות.</h1><p>העלאת תעודת יושר, בדיקת רקע, הכשרות, עזרה ראשונה ותוקף מסמכים.</p></div><span className="pill good">בדיקה ואישור</span></div>
      <StaffDocumentUpload gardenId={profile.garden_id} staffId={staffId} documents={(data ?? []) as any[]} />
    </DashboardShell>
  );
}
