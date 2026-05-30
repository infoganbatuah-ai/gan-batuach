import Link from "next/link";
import { CalendarDays, CheckCircle2, MapPin, ShieldAlert, ShieldCheck, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { createParentLead } from "@/app/actions";
import { formatAgeGroups, formatPublicPriceRange, getKindergartenAgeGroups, type KindergartenAgeGroup } from "@/lib/kindergarten-age-groups";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PublicGarden = {
  id: string;
  name: string;
  city: string;
  address?: string | null;
  owner_name?: string | null;
  framework_type?: string | null;
  children_capacity?: number | null;
  current_children_count?: number | null;
  manager?: { full_name?: string | null } | null;
  safe_status?: string | null;
  last_inspection_score?: number | null;
  last_inspection_at?: string | null;
  next_inspection_at?: string | null;
  public_profile_enabled?: boolean | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  ages?: string[] | null;
  supported_age_groups?: KindergartenAgeGroup[];
};

type GardenSearchParams = { lead?: string; name?: string; city?: string; manager?: string; age?: string; status?: string; min_score?: string; lat?: string; lng?: string };

function distanceKm(lat1: number, lng1: number, lat2?: number | null, lng2?: number | null) {
  if (lat2 == null || lng2 == null) return Number.POSITIVE_INFINITY;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getPublicGardens(filters: GardenSearchParams) {
  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("gardens")
      .select("id, name, city, address, owner_name, framework_type, children_capacity, current_children_count, safe_status, last_inspection_score, last_inspection_at, next_inspection_at, public_profile_enabled, gps_lat, gps_lng, manager:profiles!gardens_manager_id_fkey(full_name)")
      .eq("public_profile_enabled", true)
      .limit(24);
    if (filters.name) query = query.ilike("name", `%${filters.name}%`);
    if (filters.city) query = query.ilike("city", `%${filters.city}%`);
    if (filters.status) query = query.eq("safe_status", filters.status);
    if (filters.min_score) query = query.gte("last_inspection_score", Number(filters.min_score));
    const { data } = await query;
    let rows = (data ?? []) as unknown as PublicGarden[];
    rows = await Promise.all(rows.map(async (garden) => ({
      ...garden,
      supported_age_groups: await getKindergartenAgeGroups(supabase, garden.id, garden)
    })));
    if (filters.manager) rows = rows.filter((garden) => (garden.manager?.full_name ?? garden.owner_name ?? "").includes(filters.manager ?? ""));
    if (filters.age) rows = rows.filter((garden) => formatAgeGroups(garden.supported_age_groups ?? []).includes(filters.age ?? ""));
    const lat = Number(filters.lat);
    const lng = Number(filters.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) rows = rows.sort((a, b) => distanceKm(lat, lng, a.gps_lat, a.gps_lng) - distanceKm(lat, lng, b.gps_lat, b.gps_lng));
    return rows;
  } catch {
    return [] as PublicGarden[];
  }
}

function formatDate(date?: string | null) {
  return date ? new Date(date).toLocaleDateString("he-IL") : "טרם נקבע";
}

function safeStatus(status?: string | null) {
  if (status === "safe") return { label: "גן בטוח", className: "good", icon: ShieldCheck };
  if (status === "requires_fix") return { label: "דורש תיקון", className: "warn", icon: ShieldAlert };
  if (status === "not_compliant") return { label: "לא עומד בסטנדרט", className: "bad", icon: ShieldAlert };
  return { label: "ממתין לבדיקה", className: "", icon: CheckCircle2 };
}

export default async function GardensPage({ searchParams }: { searchParams: Promise<GardenSearchParams> }) {
  const params = await searchParams;
  const gardens = await getPublicGardens(params);

  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero slim-hero">
          <p className="eyebrow">רשימת גנים</p>
          <h1>מצאו גן פרטי עם שקיפות, סטטוס פיקוח ותהליך רישום ברור.</h1>
          <p>הכרטיסים מציגים את הנתונים שהגן בחר לפרסם ואת סטטוס הבקרה במערכת גן בטוח.</p>
          {params.lead === "sent" ? <div className="success-banner">הפנייה התקבלה ותופיע למנהלת הגן ולאדמין.</div> : null}
        </section>

        <section className="section compact-section">
          <form className="filter-bar" method="get">
            <label>שם גן<input name="name" defaultValue={params.name ?? ""} placeholder="לדוגמה: גן הפרחים" /></label>
            <label>עיר<input name="city" defaultValue={params.city ?? ""} placeholder="תל אביב, ראשון לציון..." /></label>
            <label>שם מנהלת<input name="manager" defaultValue={params.manager ?? ""} placeholder="שם מנהלת/גננת" /></label><label>גילאים<select name="age" defaultValue={params.age ?? ""}><option value="">כל הגילאים</option><option value="birth">תינוקות</option><option value="toddlers">פעוטות</option><option value="3">3-4</option><option value="4">4-5</option><option value="mixed">מעורב</option></select></label><label>סטטוס<select name="status" defaultValue={params.status ?? ""}><option value="">כל הסטטוסים</option><option value="safe">גן בטוח</option><option value="requires_fix">דורש תיקון</option><option value="not_compliant">לא עומד בסטנדרט</option></select></label><label>ציון ביקורת<input name="min_score" type="number" min="1" max="10" defaultValue={params.min_score ?? ""} placeholder="8+" /></label><label>קו רוחב<input name="lat" defaultValue={params.lat ?? ""} placeholder="למיון לפי מרחק" /></label><label>קו אורך<input name="lng" defaultValue={params.lng ?? ""} placeholder="אופציונלי" /></label><button className="button primary">סינון</button><Link className="button secondary" href="/gardens">ניקוי</Link>
          </form>

          {gardens.length === 0 ? (
            <div className="empty-state">
              <ShieldCheck size={34} />
              <h2>עדיין אין גנים ציבוריים להצגה</h2>
              <p>כאשר אדמין יפעיל פרופיל ציבורי לגן, הוא יופיע כאן עם סטטוס, ציון ביקורת ותאריכי פיקוח.</p>
              <Link className="button primary" href="/join-kindergarten">הצטרפות גן למערכת</Link>
            </div>
          ) : (
            <div className="garden-card-grid">
              {gardens.map((garden) => {
                const status = safeStatus(garden.safe_status);
                const StatusIcon = status.icon;
                return (
                  <article className="public-garden-card" key={garden.id}>
                    <div className="garden-card-top">
                      <span className={`pill ${status.className}`}><StatusIcon size={15} /> {status.label}</span>
                      <span><MapPin size={16} /> {garden.city}</span>
                    </div>
                    <div className="garden-image-placeholder">{garden.name}</div><h2>{garden.name}</h2>
                    <p>{garden.address ?? "כתובת תוצג לפי הרשאת הגן"} · מנהלת: {garden.manager?.full_name ?? garden.owner_name ?? "לא צוין"}</p>
                    <div className="garden-facts">
                      <span><UsersRound size={16} /> מקבל: {formatAgeGroups(garden.supported_age_groups ?? [])}</span>
                      <span><UsersRound size={16} /> {formatPublicPriceRange(garden.supported_age_groups ?? [])}</span>
                      <span><UsersRound size={16} /> ילדים: {garden.current_children_count ?? 0}/{garden.children_capacity ?? 0}</span>
                      <span><ShieldCheck size={16} /> ציון אחרון: {garden.last_inspection_score ?? "טרם בוצעה ביקורת"}</span>
                      <span><CalendarDays size={16} /> ביקורת אחרונה: {formatDate(garden.last_inspection_at)}</span>
                      <span><CalendarDays size={16} /> ביקורת הבאה: {formatDate(garden.next_inspection_at)}</span>
                    </div>
                    <div className="actions"><Link className="button primary" href={`/gardens/${garden.id}`}>צפייה בפרטי הגן</Link><Link className="button" href="/login">כניסת הורים</Link><Link className="button" href="/login">כניסת צוות/גננת</Link></div><details className="lead-details">
                      <summary className="button secondary">הורים - בדיקת זמינות / הצטרפות</summary>
                      <form action={createParentLead} className="form guided-form">
                        <input type="hidden" name="garden_id" value={garden.id} />
                        <label>שם הורה מלא<input name="parent_name" required placeholder="שם פרטי ומשפחה" /></label>
                        <label>טלפון<input name="phone" required placeholder="050-0000000" /></label>
                        <label>מייל<input name="email" type="email" placeholder="name@example.com" /></label>
                        <label>שם הילד/ים אם ידוע<input name="children_names" placeholder="לדוגמה: נועה, איתי" /></label>
                        <label>גיל הילד<input name="child_age" placeholder="לדוגמה: שנתיים וחצי" /></label>
                        <label>תאריך כניסה רצוי<input name="desired_enrollment_date" type="date" /></label>
                        <label className="wide">הערות<textarea name="notes" rows={3} placeholder="כל דבר שחשוב שהגן ידע לפני יצירת קשר" /></label>
                        <button className="button primary" type="submit">שליחת פנייה לגן</button>
                      </form>
                    </details>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
