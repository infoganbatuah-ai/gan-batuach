import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Image as ImageIcon,
  MapPin,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import {
  DashboardGrid,
  EmptyState,
  MetricCard,
  PremiumCard,
  ResponsivePage,
  SectionHeader,
  StatusChip
} from "@/components/gan-batuach-design-system";
import { ParentRegistrationJourney } from "@/components/parent-registration-journey";
import { parentTrustTone, trustBadgeLabel } from "@/lib/domain/parent-trust";
import { formatAgeGroups, formatPublicPriceRange, getKindergartenAgeGroups } from "@/lib/kindergarten-age-groups";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "טרם נקבע";
}

function PublicGardenHeader() {
  return (
    <header className="gb-public-header">
      <Link href="/" className="gb-public-brand" aria-label="גן בטוח">
        <Image src="/assets/company-symbol.png" alt="" width={48} height={48} />
        <Image src="/assets/company-name.png" alt="גן בטוח" width={146} height={46} />
      </Link>
      <nav aria-label="ניווט ציבורי">
        <Link href="/gardens">רשימת גנים</Link>
        <Link href="/parents">להורים</Link>
        <Link href="/app">כניסה למערכת</Link>
      </nav>
      <div className="gb-public-header-actions">
        <Link className="gb-public-button ghost" href="/app/login">התחברות</Link>
        <Link className="gb-public-button primary" href="/app/register/parent">הרשמה כהורה</Link>
      </div>
    </header>
  );
}

export default async function PublicGardenProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const [gardenRes, staff, children, parents, inspections, trustRes, badgeRes] = await Promise.all([
    supabase.from("gardens").select("*, manager:profiles!gardens_manager_id_fkey(full_name, phone)").eq("id", id).single(),
    supabase.from("staff").select("id, role_title, approved_to_work").eq("garden_id", id).limit(10),
    supabase.from("children").select("id", { count: "exact", head: true }).eq("garden_id", id).eq("status", "active"),
    supabase.from("parents").select("id", { count: "exact", head: true }).eq("garden_id", id),
    supabase.from("inspections").select("id, weighted_score, completed_at, violation_count, status").eq("garden_id", id).order("completed_at", { ascending: false }).limit(3),
    supabase.from("parent_trust_profiles" as any).select("*").eq("garden_id", id).eq("approved_for_parent_visibility", true).maybeSingle(),
    supabase.from("parent_trust_badges" as any).select("*").eq("garden_id", id).eq("active", true).order("issued_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  const garden = gardenRes.data as any;
  if (!garden || !garden.public_profile_enabled) {
    return (
      <>
        <PublicGardenHeader />
        <ResponsivePage className="gb-public-page" size="md">
          <EmptyState icon={Building2} title="פרופיל הגן לא זמין לציבור" text="ייתכן שהגן עדיין ממתין לאישור אדמין או שלא אישר הצגה ציבורית." action={<Link className="gb-public-button primary" href="/gardens">חזרה לרשימת הגנים</Link>} />
        </ResponsivePage>
      </>
    );
  }
  const ageGroups = await getKindergartenAgeGroups(supabase, garden.id, garden);
  const trust = trustRes.data as any;
  const badge = badgeRes.data as any;
  const trustTone = parentTrustTone(Number(trust?.trust_score ?? 0));

  return (
    <>
      <PublicGardenHeader />
      <ResponsivePage className="gb-public-page gb-garden-profile-page" size="lg">
        <section className="gb-garden-profile-hero">
          <div>
            <StatusChip tone="primary" icon={ShieldCheck}>פרופיל גן ציבורי</StatusChip>
            <h1>{garden.name}</h1>
            <p><MapPin size={18} /> {garden.city} · {garden.address ?? "כתובת כללית לפי הרשאת הגן"} · מנהלת: {garden.manager?.full_name ?? garden.owner_name ?? "לא צוין"}</p>
            <div className="gb-public-hero-actions">
              <Link className="gb-public-button primary large" href="#registration">בקשת הצטרפות</Link>
              <Link className="gb-public-button soft large" href={`/app/login?gardenId=${garden.id}&audience=parent`}>התחברות הורה</Link>
              <Link className="gb-public-button ghost large" href="/gardens">חזרה לרשימה</Link>
            </div>
          </div>
          <div className="gb-garden-profile-art">
            {garden.image_url ? <img src={garden.image_url} alt={garden.name} /> : <Building2 size={64} />}
          </div>
        </section>

        <DashboardGrid columns={4}>
          <MetricCard icon={ShieldCheck} label="סטטוס" value={garden.safe_status === "safe" ? "גן בטוח" : "בתהליך"} hint="מידע ציבורי בלבד" tone={garden.safe_status === "safe" ? "success" : "warning"} />
          <MetricCard icon={UsersRound} label="ילדים פעילים" value={children.count ?? 0} hint={`${parents.count ?? 0} הורים מחוברים`} tone="primary" />
          <MetricCard icon={ClipboardCheck} label="ציון ביקורת" value={garden.last_inspection_score ?? "טרם"} hint={`אחרונה: ${dateText(garden.last_inspection_at)}`} tone="info" />
          <MetricCard icon={CalendarDays} label="ביקורת הבאה" value={dateText(garden.next_inspection_at)} hint="לפי תכנית הפיקוח" tone="muted" />
        </DashboardGrid>

        <section className="gb-public-section">
          <PremiumCard className="gb-garden-trust-panel">
            <div>
              <StatusChip tone={trustTone === "good" ? "success" : trustTone === "warn" ? "warning" : "muted"} icon={CheckCircle2}>{badge?.public_label ?? trustBadgeLabel(trust?.trust_badge_status)}</StatusChip>
              <h2>סיכום אמון ציבורי</h2>
              <p>{badge?.public_summary ?? trust?.parent_summary ?? "תג האמון הציבורי יוצג לאחר אישור נתוני שקיפות."}</p>
            </div>
            <div className="gb-garden-trust-score">
              <b>{trust?.trust_score ?? "חדש"}</b>
              <span>מתוך 100</span>
            </div>
          </PremiumCard>
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="מידע ציבורי" title="מה אפשר לדעת על הגן?" subtitle="העמוד מציג רק נתונים שאושרו להצגה ציבורית. מסמכים, מצלמות ודוחות פנימיים אינם מוצגים כאן." />
          <DashboardGrid columns={2}>
            <PremiumCard className="gb-garden-info-card">
              <span><ImageIcon size={26} /></span>
              <h3>קבוצות גיל ומחירים</h3>
              <p>קבוצות גיל שהגן פרסם: <strong>{formatAgeGroups(ageGroups)}</strong></p>
              <div className="gb-directory-garden-tags">
                {ageGroups.length ? ageGroups.map((group) => (
                  <span key={group.id ?? group.label}>{group.age_range ? `${group.label} · ${group.age_range}` : group.label}{group.show_price_public && group.monthly_fee ? ` · ₪${Number(group.monthly_fee).toLocaleString("he-IL")}` : ""}</span>
                )) : <span>הגן טרם הגדיר קבוצות גיל לפרסום</span>}
              </div>
              <b>{formatPublicPriceRange(ageGroups)}</b>
            </PremiumCard>
            <PremiumCard className="gb-garden-info-card">
              <span><Camera size={26} /></span>
              <h3>צוות, מצלמות ופיקוח</h3>
              <p>צוות רשום: <strong>{staff.data?.length ?? 0}</strong>. מצלמות וצפייה זמינות רק למורשים לפי מדיניות, בלי חשיפת כתובות או סיסמאות.</p>
              <div className="gb-directory-garden-tags">
                <span><UsersRound size={15} /> קיבולת: {garden.children_capacity ?? "לא צוין"}</span>
                <span><ShieldCheck size={15} /> מצלמות לפי הרשאה בלבד</span>
                <span><ClipboardCheck size={15} /> דוחות מלאים להורים מורשים בלבד</span>
              </div>
            </PremiumCard>
          </DashboardGrid>
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="ביקורות" title="סיכום ביקורות אחרונות" subtitle="פירוט פנימי, ראיות וליקויים מלאים אינם מוצגים לציבור אלא אם אושרו לפרסום." />
          <DashboardGrid min="260px">
            {(inspections.data ?? []).length === 0 ? (
              <PremiumCard className="gb-garden-info-card">
                <h3>אין ביקורות ציבוריות עדיין</h3>
                <p>לאחר ביצוע ביקורת ואישור הצגה ציבורית, הסיכום יופיע כאן.</p>
              </PremiumCard>
            ) : (inspections.data ?? []).map((inspection: any) => (
              <PremiumCard key={inspection.id} className="gb-garden-inspection-card">
                <StatusChip tone={inspection.status === "done" ? "success" : "warning"} icon={ClipboardCheck}>{inspection.status ?? "במעקב"}</StatusChip>
                <h3>ציון {inspection.weighted_score ?? "-"}</h3>
                <p>{dateText(inspection.completed_at)}</p>
                <span>{inspection.violation_count ?? 0} ליקויים לתיקון</span>
              </PremiumCard>
            ))}
          </DashboardGrid>
        </section>

        <section className="gb-public-section" id="registration">
          <SectionHeader eyebrow="בקשת הצטרפות" title="רוצים להצטרף לגן?" subtitle="הבקשה עוברת למנהלת הגן. גישה מלאה נפתחת רק לאחר אישור והפעלה לפי המדיניות." />
          <ParentRegistrationJourney garden={garden} ageGroups={ageGroups} compact />
        </section>
      </ResponsivePage>
    </>
  );
}
