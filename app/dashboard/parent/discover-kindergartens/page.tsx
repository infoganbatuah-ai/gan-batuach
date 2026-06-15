import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { EnrollmentRequestButton } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function DiscoverKindergartensPage({ searchParams }: { searchParams?: Promise<{ city?: string; age?: string; q?: string }> }) {
  const { profile } = await requireRole(["parent"]);
  const params = await searchParams;
  const userSupabase = await createClient();
  const childProfiles = await userSupabase.from("permanent_child_files" as any)
    .select("id,full_name,birth_date,owner_status")
    .eq("primary_parent_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const admin = isAdminClientConfigured() ? createAdminClient() : null;
  let gardens: any[] = [];
  let feeGroupsByGarden = new Map<string, any[]>();
  if (admin) {
    let query = admin.from("gardens" as any)
      .select("id,name,city,address,ages,framework_type,status,safe_status,public_profile_enabled,eligible_for_safe_status,last_inspection_score")
      .eq("status", "active")
      .eq("public_profile_enabled", true)
      .order("city")
      .limit(120);
    if (params?.city) query = query.ilike("city", `%${params.city}%`);
    if (params?.q) query = query.ilike("name", `%${params.q}%`);
    const gardenRes = await query;
    gardens = (gardenRes.data ?? []) as any[];
    const gardenIds = gardens.map((garden) => garden.id);
    if (gardenIds.length) {
      const groups = await admin.from("kindergarten_fee_groups" as any)
        .select("id,garden_id,group_name,age_range,monthly_fee,show_price_public,active,capacity")
        .in("garden_id", gardenIds)
        .eq("active", true)
        .order("group_name");
      for (const group of (groups.data ?? []) as any[]) {
        const list = feeGroupsByGarden.get(group.garden_id) ?? [];
        list.push(group);
        feeGroupsByGarden.set(group.garden_id, list);
      }
    }
  }

  return (
    <DashboardShell role="parent" title="גילוי גנים">
      <section className="dashboard-hero-card parent-hero-card">
        <div>
          <p className="eyebrow">גנים זמינים</p>
          <h1>בחרו גן והגישו בקשת הצטרפות.</h1>
          <p>מוצגים רק פרטים ציבוריים שהגן אישר: שם, עיר, כתובת כללית, קבוצות גיל ומחיר רק אם פורסם.</p>
        </div>
        <span className="pill good">{gardens.length} גנים ציבוריים</span>
      </section>

      <section className="filter-bar">
        <form className="filter-bar" action="/dashboard/parent/discover-kindergartens">
          <input name="q" placeholder="שם גן" defaultValue={params?.q ?? ""} />
          <input name="city" placeholder="עיר" defaultValue={params?.city ?? ""} />
          <input name="age" placeholder="קבוצת גיל" defaultValue={params?.age ?? ""} />
          <button className="button secondary" type="submit">סינון</button>
        </form>
      </section>

      {!admin ? <div className="error-banner">Service Role לא מוגדר, ולכן גילוי הגנים הציבורי אינו זמין כרגע.</div> : null}
      <section className="procedure-list">
        {gardens.map((garden) => {
          const feeGroups = feeGroupsByGarden.get(garden.id) ?? [];
          const visibleGroups = params?.age ? feeGroups.filter((group) => `${group.group_name} ${group.age_range ?? ""}`.includes(params.age ?? "")) : feeGroups;
          return (
            <article className="card procedure-card" key={garden.id}>
              <div>
                <span className={garden.eligible_for_safe_status ? "pill good" : "pill warn"}><ShieldCheck size={14} /> {garden.eligible_for_safe_status ? "אמון ציבורי" : "פרופיל ציבורי"}</span>
                <h3>{garden.name}</h3>
                <p><MapPin size={14} /> {garden.city} · {garden.address ?? "כתובת כללית לא פורסמה"}</p>
                <small>קבוצות גיל: {(garden.ages ?? []).join(", ") || visibleGroups.map((group) => group.group_name).join(", ") || "לא פורסם"}</small>
                <div className="setup-checklist">
                  {visibleGroups.map((group) => <span key={group.id}>{group.group_name}: {group.show_price_public ? `${group.monthly_fee} ₪ לחודש` : "מחיר לא פורסם"}</span>)}
                </div>
              </div>
              <div className="procedure-meta">
                <Building2 />
                <EnrollmentRequestButton gardenId={garden.id} childProfiles={(childProfiles.data ?? []) as any[]} feeGroups={visibleGroups} />
              </div>
            </article>
          );
        })}
        {gardens.length === 0 ? <div className="empty-state"><strong>לא נמצאו גנים ציבוריים</strong><span>אפשר לשנות סינון או לפנות לגן כדי שיפרסם פרופיל ציבורי.</span></div> : null}
      </section>
    </DashboardShell>
  );
}
