import { Building2, MapPin, Search, ShieldCheck, SlidersHorizontal, Star, UsersRound } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { EnrollmentRequestButton } from "@/components/self-service-forms";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guardianChildIds } from "@/lib/management/family-link";
import { findEligibleGardensForChild } from "@/lib/domain/child-garden-discovery";

export default async function DiscoverKindergartensPage({ searchParams }: { searchParams?: Promise<{ city?: string; age?: string; q?: string; child?: string }> }) {
  const { profile } = await requireRole(["parent"]);
  const params = await searchParams;
  const userSupabase = await createClient();
  const childFileIds = await guardianChildIds(userSupabase, profile.id);
  const childProfiles = childFileIds.length ? await userSupabase.from("permanent_child_files" as any)
    .select("id,full_name,birth_date,owner_status")
    .in("id", childFileIds)
    .order("created_at", { ascending: false })
    .limit(20) : { data: [], error: null };

  const children = (childProfiles.data ?? []) as any[];
  const selectedChild = children.find((child) => child.id === params?.child) ?? children[0] ?? null;
  const discovery = selectedChild
    ? await findEligibleGardensForChild(userSupabase, profile.id, selectedChild.id, { city: params?.city, query: params?.q })
    : { kind: "ok" as const, matches: [] as any[] };
  const gardens = discovery.kind === "ok" ? discovery.matches as any[] : [];

  return (
    <DashboardShell role="parent" title="גילוי גנים" appHome>
      <ParentAppFrame active="dashboard" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="גני ילדים בטוחים באזור שלי" subtitle="מצא/י את הגן המתאים ביותר עבור הילד/ה שלך" />

        <form className="parent-discovery-search" action="/dashboard/parent/discover-kindergartens">
          <button className="parent-filter-button" type="submit"><SlidersHorizontal size={22} /> סינון</button>
          <label>
            <Search size={24} />
            <input name="q" placeholder="חפש גן ילדים, עיר או שכונה..." defaultValue={params?.q ?? ""} />
          </label>
          <input name="city" placeholder="עיר" defaultValue={params?.city ?? ""} />
          <input name="age" placeholder="קבוצת גיל" defaultValue={params?.age ?? ""} />
          <select name="child" defaultValue={selectedChild?.id ?? ""} aria-label="בחירת ילד">
            {children.map((child) => <option key={child.id} value={child.id}>{child.full_name}</option>)}
          </select>
          <button className="parent-search-submit" type="submit">חיפוש</button>
        </form>

        <nav className="parent-discovery-pills" aria-label="סינון מהיר">
          <span><UsersRound size={18} /> כל הגילים</span>
          <span><Star size={18} /> פרופיל ציבורי</span>
          <span><MapPin size={18} /> עיר / אזור</span>
          <span><ShieldCheck size={18} /> מומלץ</span>
        </nav>

        <ParentSection title="גני ילדים בטוחים באזור שלך" subtitle={selectedChild ? `התאמות עבור ${selectedChild.full_name}. הזמינות אינה שומרת מקום.` : "יש ליצור או לקשר כרטיס ילד לפני חיפוש גן."}>
          <div className="parent-garden-list">
            {gardens.map((garden, index) => {
              const classrooms = (garden.matching_classrooms ?? []) as any[];
              const publicPrice = garden.monthly_price;
              const eligible = garden.match_status === "eligible";
              return (
                <article className={`parent-garden-card ${index === 0 ? "featured" : ""}`} key={garden.id}>
                  <div className="parent-garden-image">
                    {garden.image_url ? (
                      <img src={garden.image_url} alt={`תמונת ${garden.name}`} />
                    ) : (
                      <div className="parent-garden-image-empty">
                        <Building2 size={38} />
                        <small>הגן טרם העלה תמונה ציבורית</small>
                      </div>
                    )}
                    <span>{eligible ? "מתאים לילד" : garden.reason_code ?? "פרופיל ציבורי"}</span>
                  </div>
                  <div className="parent-garden-content">
                    <div>
                      <span className="parent-safe-badge"><ShieldCheck size={18} /> {garden.match_status === "pending_request" ? "בקשה ממתינה" : eligible ? "מקום זמין" : "פרופיל ציבורי"}</span>
                      <h3>{garden.garden_name}</h3>
                      <p><MapPin size={16} /> {garden.city} · {garden.public_address ?? "כתובת כללית לא פורסמה"}</p>
                    </div>
                    <div className="parent-garden-metrics">
                      <span><b>{garden.price_status === "configured" ? `₪${Number(publicPrice).toLocaleString("he-IL")}` : "לא הוגדר"}</b><small>תשלום חודשי</small></span>
                      <span><b>{garden.available_seats ?? "לא הוגדר"}</b><small>מקומות זמינים</small></span>
                      <span><b>{garden.enrollment_availability}</b><small>הרשמה</small></span>
                      <span><b>{garden.distance_status === "distance_unavailable" ? "לא זמין" : garden.distance_km}</b><small>מרחק</small></span>
                    </div>
                    <div className="parent-garden-groups">
                      {classrooms.slice(0, 3).map((room) => <span key={room.id}>{room.name}: {room.available_seats ?? "זמינות טרם הוגדרה"} מקומות</span>)}
                    </div>
                    <div className="parent-garden-actions">
                      <Link className="button secondary" href={`/gardens/${garden.garden_id}`}>צפייה בפרטי הגן</Link>
                      {eligible ? <EnrollmentRequestButton gardenId={garden.garden_id} childProfiles={selectedChild ? [selectedChild] : []} feeGroups={[]} /> : null}
                    </div>
                  </div>
                </article>
              );
            })}
            {gardens.length === 0 ? <ParentEmptyState title={selectedChild ? "לא נמצאו התאמות" : "נדרש כרטיס ילד"} text={selectedChild ? "אפשר לשנות עיר או חיפוש. גן מלא, סגור או לא תואם מסומן באופן מפורש." : "יש ליצור או לקשר כרטיס ילד מורשה לפני הצגת התאמות."} /> : null}
          </div>
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
