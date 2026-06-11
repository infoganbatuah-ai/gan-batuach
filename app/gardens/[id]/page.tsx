import Link from "next/link";
import { Camera, CalendarDays, ClipboardCheck, Image, ShieldCheck, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ParentRegistrationJourney } from "@/components/parent-registration-journey";
import { parentTrustTone, trustBadgeLabel } from "@/lib/domain/parent-trust";
import { formatAgeGroups, formatPublicPriceRange, getKindergartenAgeGroups } from "@/lib/kindergarten-age-groups";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "טרם נקבע";
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
    return <><BrandHeader /><main className="section"><div className="empty-state"><strong>פרופיל הגן לא זמין לציבור</strong><span>ייתכן שהגן עדיין ממתין לאישור אדמין.</span></div></main></>;
  }
  const ageGroups = await getKindergartenAgeGroups(supabase, garden.id, garden);
  const trust = trustRes.data as any;
  const badge = badgeRes.data as any;

  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero slim-hero">
          <p className="eyebrow">פרופיל גן ציבורי</p>
          <h1>{garden.name}</h1>
          <p>{garden.city} · {garden.address ?? "כתובת לפי הרשאת הגן"} · מנהלת: {garden.manager?.full_name ?? garden.owner_name ?? "לא צוין"}</p>
          <div className="actions"><Link className="button primary" href="#registration">רישום הורה</Link><Link className="button secondary" href={`/login?gardenId=${garden.id}&audience=parent`}>התחברות הורה</Link><Link className="button" href={`/login?gardenId=${garden.id}&audience=staff`}>התחברות צוות / גננת</Link></div>
        </section>

        <section className="section grid cols-3 dashboard-kpis">
          <div className="card health-card"><ShieldCheck /> {garden.safe_status}</div>
          <div className="card health-card"><UsersRound /> {children.count ?? 0} ילדים · {parents.count ?? 0} הורים</div>
          <div className="card health-card"><CalendarDays /> ביקורת הבאה {dateText(garden.next_inspection_at)}</div>
        </section>

        <section className="section public-trust-badge-panel">
          <div>
            <p className="eyebrow">Gan Batuach Certified</p>
            <h2>{badge?.public_label ?? trustBadgeLabel(trust?.trust_badge_status)}</h2>
            <p>{badge?.public_summary ?? trust?.parent_summary ?? "תג האמון הציבורי יוצג לאחר אישור נתוני שקיפות."}</p>
          </div>
          <span className={`pill ${parentTrustTone(Number(trust?.trust_score ?? 0))}`}>אמון {trust?.trust_score ?? "חדש"}/100</span>
        </section>

        <section className="section grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2>פרטים ותמונות</h2>
            <div className="garden-image-placeholder"><Image /> {garden.name}</div>
            <p>גילאים / קבוצות שהגן מקבל: <strong>{formatAgeGroups(ageGroups)}</strong>. {formatPublicPriceRange(ageGroups)}. קיבולת: {garden.children_capacity ?? "לא צוין"}. סטטוס גן בטוח מוצג לפי נתוני הפיקוח במערכת.</p>
            <div className="tag-cloud">{ageGroups.length ? ageGroups.map((group) => <span key={group.id ?? group.label}>{group.age_range ? `${group.label} · ${group.age_range}` : group.label}{group.show_price_public && group.monthly_fee ? ` · ₪${Number(group.monthly_fee).toLocaleString("he-IL")}` : ""}</span>) : <span>הגן טרם הגדיר קבוצות גיל</span>}</div>
          </article>
          <article className="card action-panel">
            <h2>צוות וסיכום פיקוח</h2>
            <div className="risk-list"><div><UsersRound /> אנשי צוות <b>{staff.data?.length ?? 0}</b></div><div><ClipboardCheck /> ציון אחרון <b>{garden.last_inspection_score ?? "טרם"}</b></div><div><Camera /> מצלמות <b>לפי הרשאה בלבד</b></div><div><ShieldCheck /> סטטוס אמון <b>{badge?.public_label ?? "במעקב"}</b></div></div>
          </article>
        </section>

        <section className="section grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2>ביקורות</h2>
            <p>דוחות מלאים זמינים רק להורים של הגן, צוות, מנהלת, בעלים, פקח ואדמין.</p>
            {(inspections.data ?? []).map((inspection: any) => <div className="list-item" key={inspection.id}><div><strong>ציון {inspection.weighted_score ?? "-"}</strong><span>{dateText(inspection.completed_at)}</span></div><span className="pill">{inspection.violation_count ?? 0} ליקויים</span></div>)}
          </article>
          <ParentRegistrationJourney garden={garden} ageGroups={ageGroups} compact />
        </section>
      </main>
    </>
  );
}
