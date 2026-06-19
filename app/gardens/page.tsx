import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UsersRound
} from "lucide-react";
import {
  DashboardGrid,
  EmptyState,
  FormField,
  PremiumCard,
  ResponsivePage,
  SearchFilterBar,
  SectionHeader,
  StatusChip
} from "@/components/gan-batuach-design-system";
import { trustBadgeLabel } from "@/lib/domain/parent-trust";
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
  parent_trust_profiles?: Array<{ trust_score?: number | null; trust_badge_status?: string | null; public_profile_ready?: boolean | null }> | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  ages?: string[] | null;
  supported_age_groups?: KindergartenAgeGroup[];
};

type GardenSearchParams = { lead?: string; error?: string; name?: string; city?: string; manager?: string; age?: string; status?: string; min_score?: string; lat?: string; lng?: string };

function distanceKm(lat1: number, lng1: number, lat2?: number | null, lng2?: number | null) {
  if (lat2 == null || lng2 == null) return Number.POSITIVE_INFINITY;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function gardenMatchesAge(garden: PublicGarden, filter?: string) {
  const needle = filter?.trim().toLowerCase();
  if (!needle) return true;
  const groups = garden.supported_age_groups ?? [];
  const searchable = [
    formatAgeGroups(groups),
    garden.framework_type,
    ...(garden.ages ?? []),
    ...groups.flatMap((group) => [group.label, group.age_range, group.source])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return searchable.includes(needle);
}

async function getPublicGardens(filters: GardenSearchParams) {
  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("gardens")
      .select("id, name, city, address, owner_name, framework_type, children_capacity, current_children_count, safe_status, last_inspection_score, last_inspection_at, next_inspection_at, public_profile_enabled, gps_lat, gps_lng, manager:profiles!gardens_manager_id_fkey(full_name), parent_trust_profiles(trust_score, trust_badge_status, public_profile_ready)")
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
    if (filters.age) rows = rows.filter((garden) => gardenMatchesAge(garden, filters.age));
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
  if (status === "safe") return { label: "גן בטוח", tone: "success" as const, icon: ShieldCheck };
  if (status === "requires_fix") return { label: "דורש תיקון", tone: "warning" as const, icon: ShieldAlert };
  if (status === "not_compliant") return { label: "לא עומד בסטנדרט", tone: "danger" as const, icon: ShieldAlert };
  return { label: "ממתין לבדיקה", tone: "muted" as const, icon: CheckCircle2 };
}

function PublicDirectoryHeader() {
  return (
    <header className="gb-public-header">
      <Link href="/" className="gb-public-brand" aria-label="גן בטוח">
        <Image src="/assets/company-symbol.png" alt="" width={48} height={48} />
        <Image src="/assets/company-name.png" alt="גן בטוח" width={146} height={46} />
      </Link>
      <nav aria-label="ניווט ציבורי">
        <Link href="/">ראשי</Link>
        <Link href="/parents">להורים</Link>
        <Link href="/digital-observer">Digital Observer</Link>
      </nav>
      <div className="gb-public-header-actions">
        <Link className="gb-public-button ghost" href="/app/login">התחברות</Link>
        <Link className="gb-public-button primary" href="/app/register">הרשמה</Link>
      </div>
    </header>
  );
}

export default async function GardensPage({ searchParams }: { searchParams: Promise<GardenSearchParams> }) {
  const params = await searchParams;
  const gardens = await getPublicGardens(params);

  return (
    <>
      <PublicDirectoryHeader />
      <ResponsivePage className="gb-public-page gb-directory-page" size="lg">
        <section className="gb-directory-hero">
          <StatusChip tone="primary" icon={ShieldCheck}>רשימת גנים</StatusChip>
          <h1>מצאו גן ילדים בטוח באזור שלכם</h1>
          <p>רק גנים עם פרופיל ציבורי מאושר מוצגים כאן. המידע נשאר ציבורי ובטוח: עיר, אזור כללי, קבוצות גיל, מחיר שפורסם וסטטוס אמון.</p>
          {params.lead === "sent" ? <div className="success-banner">הפנייה התקבלה ותופיע למנהלת הגן ולאדמין.</div> : null}
          {params.error ? <div className="error-banner">{params.error}</div> : null}
        </section>

        <form className="gb-directory-filter-form" method="get">
          <SearchFilterBar
            search={<><Search size={20} /> חיפוש</>}
            action={<button className="gb-public-button primary" type="submit"><SlidersHorizontal size={18} /> סינון</button>}
          >
            <FormField label="שם גן" name="name" defaultValue={params.name ?? ""} placeholder="לדוגמה: גן הפרחים" />
            <FormField label="עיר" name="city" defaultValue={params.city ?? ""} placeholder="תל אביב, חיפה..." />
            <FormField label="שם מנהלת" name="manager" defaultValue={params.manager ?? ""} placeholder="שם מנהלת / גננת" />
            <label className="gb-form-field">
              <span>גילאים</span>
              <select name="age" defaultValue={params.age ?? ""}>
                <option value="">כל הגילאים</option>
                <option value="birth">תינוקות</option>
                <option value="toddlers">פעוטות</option>
                <option value="3">3-4</option>
                <option value="4">4-5</option>
                <option value="mixed">מעורב</option>
              </select>
            </label>
            <label className="gb-form-field">
              <span>סטטוס</span>
              <select name="status" defaultValue={params.status ?? ""}>
                <option value="">כל הסטטוסים</option>
                <option value="safe">גן בטוח</option>
                <option value="requires_fix">דורש תיקון</option>
                <option value="not_compliant">לא עומד בסטנדרט</option>
              </select>
            </label>
            <FormField label="ציון מינימלי" name="min_score" type="number" min="1" max="10" defaultValue={params.min_score ?? ""} placeholder="8+" />
          </SearchFilterBar>
          <Link className="gb-directory-clear-link" href="/gardens">ניקוי סינון</Link>
        </form>

        {gardens.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="עדיין אין גנים ציבוריים להצגה"
            text="כאשר אדמין יפעיל פרופיל ציבורי לגן, הוא יופיע כאן עם סטטוס, ציון ביקורת ותאריכי פיקוח."
            action={<Link className="gb-public-button primary" href="/join-kindergarten">הצטרפות גן למערכת</Link>}
          />
        ) : (
          <section className="gb-directory-results">
            <SectionHeader eyebrow={`${gardens.length} גנים`} title="גנים זמינים לצפייה ציבורית" />
            <div className="gb-directory-list">
              {gardens.map((garden) => {
                const status = safeStatus(garden.safe_status);
                const trustScore = garden.parent_trust_profiles?.[0]?.trust_score ?? garden.last_inspection_score ?? null;
                return (
                  <PremiumCard className="gb-directory-garden-card" key={garden.id}>
                    <div className="gb-directory-garden-art">
                      <Building2 size={36} />
                      <span>{garden.city}</span>
                    </div>
                    <div className="gb-directory-garden-main">
                      <div className="gb-directory-garden-head">
                        <StatusChip tone={status.tone} icon={status.icon}>{status.label}</StatusChip>
                        <span><MapPin size={16} /> {garden.city} · {garden.address ?? "כתובת כללית לפי הרשאת הגן"}</span>
                      </div>
                      <h2>{garden.name}</h2>
                      <p>מנהלת: {garden.manager?.full_name ?? garden.owner_name ?? "לא צוין"} · {formatAgeGroups(garden.supported_age_groups ?? [])}</p>
                      <div className="gb-directory-garden-tags">
                        <span><UsersRound size={15} /> {garden.current_children_count ?? 0}/{garden.children_capacity ?? 0} ילדים</span>
                        <span>{formatPublicPriceRange(garden.supported_age_groups ?? [])}</span>
                        <span><CalendarDays size={15} /> ביקורת הבאה: {formatDate(garden.next_inspection_at)}</span>
                        <span><ShieldCheck size={15} /> {trustBadgeLabel(garden.parent_trust_profiles?.[0]?.trust_badge_status)}</span>
                      </div>
                    </div>
                    <div className="gb-directory-score-card">
                      <Star size={22} />
                      <b>{trustScore ?? "חדש"}</b>
                      <span>מדד אמון</span>
                      <Link className="gb-public-button primary" href={`/gardens/${garden.id}`}>בקשת הצטרפות</Link>
                      <Link className="gb-public-button soft" href={`/gardens/${garden.id}`}>לפרטים</Link>
                    </div>
                  </PremiumCard>
                );
              })}
            </div>
          </section>
        )}

        <section className="gb-public-cta-band">
          <div>
            <StatusChip tone="success" icon={CheckCircle2}>המשך באפליקציה</StatusChip>
            <h2>רוצים להגיש בקשת הצטרפות לגן?</h2>
            <p>פתחו חשבון הורה, הוסיפו ילד, בחרו גן והגישו בקשה בצורה מסודרת.</p>
          </div>
          <div className="gb-public-hero-actions">
            <Link className="gb-public-button white" href="/app/register/parent">הרשמה כהורה</Link>
            <Link className="gb-public-button outline-white" href="/app">כניסה למערכת</Link>
          </div>
        </section>
      </ResponsivePage>
    </>
  );
}
