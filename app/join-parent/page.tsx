import Link from "next/link";
import { Baby, Building2, CheckCircle2, Search } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ParentRegistrationJourney } from "@/components/parent-registration-journey";
import { formatAgeGroups, getKindergartenAgeGroups } from "@/lib/kindergarten-age-groups";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function JoinParentPage({ searchParams }: { searchParams: Promise<{ gardenId?: string; lead?: string }> }) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const selectedGardenRes = params.gardenId
    ? await supabase.from("gardens" as any).select("id, name, city, address, logo_url, image_url, public_profile_enabled").eq("id", params.gardenId).maybeSingle()
    : { data: null };
  const selectedGarden = selectedGardenRes.data as any;
  const selectedAgeGroups = selectedGarden ? await getKindergartenAgeGroups(supabase, selectedGarden.id, selectedGarden) : [];
  const { data: gardens } = await supabase
    .from("gardens" as any)
    .select("id, name, city, address, logo_url, image_url, ages, framework_type, public_profile_enabled")
    .eq("public_profile_enabled", true)
    .order("name")
    .limit(24);
  const gardenCards = await Promise.all(((gardens ?? []) as any[]).map(async (garden) => ({
    ...garden,
    ageGroups: await getKindergartenAgeGroups(supabase, garden.id, garden)
  })));

  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero registration-hero">
          <p className="eyebrow">הצטרפות הורה לגן בטוח</p>
          <h1>{selectedGarden ? `מצטרפים לגן ${selectedGarden.name}` : "בוחרים גן ומתחילים בקשת הצטרפות רגועה"}</h1>
          <p>כניסה אחת לכל המשפחה. הגן מאשר את בקשת ההצטרפות, ואז ההורה משלים את פרטי הילד מתוך הדשבורד.</p>
          {params.lead === "sent" ? <div className="success-banner"><CheckCircle2 /> הבקשה נשלחה לגן. לאחר אישור תקבלו פרטי התחברות להשלמת רישום הילד.</div> : null}
        </section>

        {!selectedGarden ? (
          <section className="section compact-section">
            <div className="section-heading"><div><p className="eyebrow">שלב 1 מתוך 5</p><h2>בחירת גן</h2><p>בחרו את הגן שאליו תרצו לשלוח בקשת הצטרפות.</p></div><Link className="button secondary" href="/gardens"><Search size={16} /> חיפוש מתקדם</Link></div>
            <div className="garden-card-grid">
              {gardenCards.map((garden) => (
                <article className="public-garden-card registration-choice-card" key={garden.id}>
                  {garden.image_url || garden.logo_url ? <img className="garden-card-image" src={garden.image_url ?? garden.logo_url} alt={garden.name} /> : <div className="garden-image-placeholder"><Building2 /> {garden.name}</div>}
                  <h3>{garden.name}</h3>
                  <p>{garden.city} · {garden.address ?? "כתובת לפי הרשאת הגן"}</p>
                  <div className="garden-facts"><span><Baby size={16} /> מקבל: {formatAgeGroups(garden.ageGroups)}</span></div>
                  <Link className="button primary" href={`/join-parent?gardenId=${garden.id}`}>בחירת הגן והמשך</Link>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="section compact-section">
            <ParentRegistrationJourney garden={selectedGarden} ageGroups={selectedAgeGroups} />
          </section>
        )}
      </main>
    </>
  );
}
