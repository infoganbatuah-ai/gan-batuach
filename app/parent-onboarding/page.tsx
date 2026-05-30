import Link from "next/link";
import { Baby, CheckCircle2, HeartPulse, ShieldCheck } from "lucide-react";
import { DashboardBackButton } from "@/components/dashboard-back-button";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentChildRegistrationWizard } from "@/components/provisioning-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

function childStatusText(status?: string | null) {
  if (status === "active" || status === "approved") return "אושר";
  if (status === "pending_manager_approval") return "ממתין לאישור הגן";
  if (status === "pending_parent_completion") return "חסרים פרטים";
  if (status === "request_missing_details") return "נדרשת השלמת פרטים";
  return "כרטיס ילד";
}

export default async function ParentOnboardingPage({ searchParams }: { searchParams?: Promise<{ childId?: string }> }) {
  const { profile } = await requireRole(["parent"]);
  const query = searchParams ? await searchParams : {};
  const userScopedSupabase = await createClient();
  const supabase = isAdminClientConfigured() ? createAdminClient() : userScopedSupabase;
  const parentByProfile = await supabase.from("parents" as any).select("*").eq("profile_id", profile.id).maybeSingle();
  const parentByUser = parentByProfile.data ? { data: null } : await supabase.from("parents" as any).select("*").eq("user_id", profile.id).maybeSingle();
  const parent = ((parentByProfile.data as any) ?? (parentByUser.data as any) ?? null) as any;
  const gardenId = profile.garden_id ?? parent?.garden_id ?? null;

  let child: any = null;
  if (parent) {
    if (query.childId) {
      const selected = await supabase.from("children" as any).select("*").eq("id", query.childId).eq("primary_parent_id", parent.id).maybeSingle();
      child = selected.data;
    }
    if (!child) {
      const preferred = await supabase
        .from("children" as any)
        .select("*")
        .eq("primary_parent_id", parent.id)
        .in("status", ["pending_parent_completion", "request_missing_details", "pending_manager_approval"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      child = preferred.data;
    }
    if (!child) {
      const existing = await supabase.from("children" as any).select("*").eq("primary_parent_id", parent.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      child = existing.data;
    }
  }

  const [gardenRes, docsRes] = await Promise.all([
    gardenId ? supabase.from("gardens" as any).select("id, name, logo_url, image_url, manager_id, owner_profile_id, phone, address, city").eq("id", gardenId).maybeSingle() : Promise.resolve({ data: null }),
    child?.id ? supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at").eq("child_id", child.id).limit(20) : Promise.resolve({ data: [] })
  ]);

  return (
    <DashboardShell role="parent" title="השלמת פרטי ילד">
      <div className="page-header-row">
        <DashboardBackButton fallbackHref="/dashboard/parent" />
        <Link className="button secondary" href="/dashboard/parent">חזרה לדשבורד ההורה</Link>
        <Link className="button secondary" href="/dashboard/parent#add-child-request">בקשת רישום ילד נוסף</Link>
      </div>

      <section className="dashboard-hero-card parent-hero-card">
        <div>
          <p className="eyebrow">כרטיס ילד</p>
          <h1>{child?.full_name ? `פרטי ${child.full_name}` : "השלמת פרטי ילד לגן"}</h1>
          <p>{child ? "הפרטים שנשמרו כבר מוצגים כאן. ניתן לערוך רק את השדות שמותרים להורה, ולהשלים רק מה שחסר." : "לא נמצא כרטיס ילד פתוח. כדי להוסיף ילד נוסף יש לשלוח בקשת רישום לגן."}</p>
        </div>
        <span className={child?.status === "active" || child?.status === "approved" ? "pill good" : "pill warn"}><CheckCircle2 size={15} /> {childStatusText(child?.status)}</span>
      </section>

      {!child ? (
        <section className="empty-state">
          <Baby size={34} />
          <strong>אין כרטיס ילד להשלמה כרגע</strong>
          <span>אם ברצונך לרשום ילד נוסף, יש לשלוח בקשה לגן. לאחר אישור המנהלת ייפתח כרטיס השלמה מסודר לילד החדש.</span>
          <Link className="button primary" href="/dashboard/parent#add-child-request">בקשת רישום ילד נוסף</Link>
        </section>
      ) : (
        <>
          <section className="grid cols-3 dashboard-kpis">
            <div className="card health-card"><ShieldCheck /> סטטוס: {childStatusText(child.status)}</div>
            <div className="card health-card"><HeartPulse /> בריאות: {child.allergies || child.medical_notes ? "יש מידע שמור" : "חסר מידע"}</div>
            <div className="card health-card"><Baby /> גן: {(gardenRes.data as any)?.name ?? "גן משויך"}</div>
          </section>
          <ParentChildRegistrationWizard child={child} parent={parent} garden={gardenRes.data as any} documents={(docsRes.data ?? []) as any[]} />
        </>
      )}
    </DashboardShell>
  );
}
