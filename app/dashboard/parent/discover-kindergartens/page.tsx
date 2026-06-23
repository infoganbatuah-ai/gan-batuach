import { Building2, MapPin, Search, ShieldCheck, SlidersHorizontal, Star, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { EnrollmentRequestButton } from "@/components/self-service-forms";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentSection } from "@/components/parent-app-ui";
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
    <DashboardShell role="parent" title="גילוי גנים" appHome>
      <ParentAppFrame active="dashboard" avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="גני ילדים בטוחים באזור שלי" subtitle="מצא/י את הגן המתאים ביותר עבור הילד/ה שלך" />

        <form className="parent-discovery-search" action="/dashboard/parent/discover-kindergartens">
          <button className="parent-filter-button" type="submit"><SlidersHorizontal size={22} /> סינון</button>
          <label>
            <Search size={24} />
            <input name="q" placeholder="חפש גן ילדים, עיר או שכונה..." defaultValue={params?.q ?? ""} />
          </label>
          <input name="city" placeholder="עיר" defaultValue={params?.city ?? ""} />
          <input name="age" placeholder="קבוצת גיל" defaultValue={params?.age ?? ""} />
          <button className="parent-search-submit" type="submit">חיפוש</button>
        </form>

        <nav className="parent-discovery-pills" aria-label="סינון מהיר">
          <span><UsersRound size={18} /> כל הגילים</span>
          <span><Star size={18} /> דירוג מינימלי</span>
          <span><MapPin size={18} /> מרחק</span>
          <span><ShieldCheck size={18} /> מומלץ</span>
        </nav>

        {!admin ? <div className="error-banner">Service Role לא מוגדר, ולכן גילוי הגנים הציבורי אינו זמין כרגע.</div> : null}

        <ParentSection title="גני ילדים קרובים אליך" subtitle="מבוסס על מיקום נוכחי">
          <div className="parent-garden-list">
            {gardens.map((garden, index) => {
              const feeGroups = feeGroupsByGarden.get(garden.id) ?? [];
              const visibleGroups = params?.age ? feeGroups.filter((group) => `${group.group_name} ${group.age_range ?? ""}`.includes(params.age ?? "")) : feeGroups;
              const publicPrice = visibleGroups.find((group) => group.show_price_public)?.monthly_fee;
              return (
                <article className={`parent-garden-card ${index === 0 ? "featured" : ""}`} key={garden.id}>
                  <div className="parent-garden-image">
                    <span>{index === 0 ? "פרופיל ציבורי" : garden.city ?? "גן ציבורי"}</span>
                  </div>
                  <div className="parent-garden-content">
                    <div>
                      <span className="parent-safe-badge"><ShieldCheck size={18} /> {garden.eligible_for_safe_status ? "גן מאושר" : "פרופיל ציבורי"}</span>
                      <h3>{garden.name}</h3>
                      <p><MapPin size={16} /> {garden.city} · {garden.address ?? "כתובת כללית לא פורסמה"}</p>
                    </div>
                    <div className="parent-garden-metrics">
                      <span><b>{publicPrice ? `₪${Number(publicPrice).toLocaleString("he-IL")}` : "לא פורסם"}</b><small>תשלום חודשי</small></span>
                      <span><b>{visibleGroups.reduce((sum, group) => sum + Number(group.capacity ?? 0), 0) || "לא פורסם"}</b><small>קיבולת שפורסמה</small></span>
                      <span><b>{garden.last_inspection_score ? `${garden.last_inspection_score}/100` : "לא פורסם"}</b><small>ציון בטיחות</small></span>
                      <span><b>{garden.safe_status ?? "בבדיקה"}</b><small>סטטוס ציבורי</small></span>
                    </div>
                    <div className="parent-garden-groups">
                      {visibleGroups.slice(0, 3).map((group) => <span key={group.id}>{group.group_name}: {group.show_price_public ? `${group.monthly_fee} ₪ לחודש` : "מחיר לא פורסם"}</span>)}
                    </div>
                    <EnrollmentRequestButton gardenId={garden.id} childProfiles={(childProfiles.data ?? []) as any[]} feeGroups={visibleGroups} />
                  </div>
                </article>
              );
            })}
            {gardens.length === 0 ? <ParentEmptyState title="לא נמצאו גנים ציבוריים" text="אפשר לשנות סינון או לפנות לגן כדי שיפרסם פרופיל ציבורי." /> : null}
          </div>
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
