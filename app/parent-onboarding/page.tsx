import Link from "next/link";
import { Baby, CheckCircle2, HeartPulse, ShieldCheck } from "lucide-react";
import { DashboardBackButton } from "@/components/dashboard-back-button";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { ParentChildRegistrationWizard } from "@/components/provisioning-forms";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { getKindergartenAgeGroups } from "@/lib/kindergarten-age-groups";
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
  const family = await getParentFamilyContext(userScopedSupabase as any, profile);
  const parents = family.parents as any[];
  let parent = parents[0] ?? null;
  let gardenId = profile.garden_id ?? parent?.garden_id ?? null;

  let child: any = null;
  if (parents.length) {
    const parentIds = parents.map((item) => item.id).filter(Boolean);
    if (query.childId) {
      const selected = await supabase.from("children" as any).select("*").eq("id", query.childId).in("primary_parent_id", parentIds).maybeSingle();
      child = selected.data;
    }
    if (!child) {
      const preferred = await supabase
        .from("children" as any)
        .select("*")
        .in("primary_parent_id", parentIds)
        .in("status", ["pending_parent_completion", "request_missing_details", "pending_manager_approval"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      child = preferred.data;
    }
    if (!child) {
      const existing = await supabase.from("children" as any).select("*").in("primary_parent_id", parentIds).order("created_at", { ascending: false }).limit(1).maybeSingle();
      child = existing.data;
    }
    if (child?.primary_parent_id) parent = parents.find((item) => item.id === child.primary_parent_id) ?? parent;
  }
  gardenId = child?.garden_id ?? gardenId;

  const [gardenRes, docsRes] = await Promise.all([
    gardenId ? supabase.from("gardens" as any).select("id, name, logo_url, image_url, manager_id, owner_profile_id, phone, address, city, ages, framework_type").eq("id", gardenId).maybeSingle() : Promise.resolve({ data: null }),
    child?.id ? supabase.from("documents" as any).select("id, name, document_type, status, expires_at, created_at").eq("child_id", child.id).limit(20) : Promise.resolve({ data: [] })
  ]);
  const ageGroups = await getKindergartenAgeGroups(supabase, gardenId, gardenRes.data);

  return (
    <DashboardShell role="parent" title="השלמת פרטי ילד" appHome>
      <ParentAppFrame active="home" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <div className="page-header-row">
          <DashboardBackButton fallbackHref="/dashboard/parent" />
          <Link className="button secondary" href="/dashboard/parent">חזרה לדשבורד ההורה</Link>
          <Link className="button secondary" href="/dashboard/parent#add-child-request">בקשת רישום ילד נוסף</Link>
        </div>

        <ParentHero
          title={child?.full_name ? `פרטי ${child.full_name}` : "השלמת פרטי ילד"}
          subtitle={child ? "מעדכנים רק את השדות שמותרים להורה ומשלימים את מה שחסר." : "כדי להוסיף ילד נוסף יש לשלוח בקשת רישום לגן."}
        />

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
          <ParentSection title="פרטים, בריאות ומסמכים" subtitle="הטופס נשאר מחובר ללוגיקה הקיימת ולשדות המאושרים.">
            <ParentChildRegistrationWizard child={child} parent={parent} garden={gardenRes.data as any} documents={(docsRes.data ?? []) as any[]} ageGroups={ageGroups} />
          </ParentSection>
        </>
      )}
      </ParentAppFrame>
    </DashboardShell>
  );
}
