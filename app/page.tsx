import Link from "next/link";
import { BarChart3, Bot, Building2, CalendarCheck, Camera, CheckCircle2, ClipboardCheck, HeartHandshake, MapPin, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ConversionBand, MarketingCard, MarketingHero, MarketingMetric, MarketingSection } from "@/components/public-marketing";
import { formatAgeGroups, formatPublicPriceRange, getKindergartenAgeGroups } from "@/lib/kindergarten-age-groups";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "גן בטוח | תקן הבטיחות, הפיקוח והשקיפות החדש לגני ילדים",
  description: "גן בטוח היא פלטפורמת בטיחות, פיקוח, שקיפות וניהול לגני ילדים. הורים מקבלים אמון, גנים מקבלים מערכת תפעול, ופיקוח מקבל תיעוד."
};

const platformPillars = [
  { icon: ClipboardCheck, title: "פיקוח שמייצר פעולה", text: "ביקורות, ממצאים, תיקון ומעקב במקום אחד. לא עוד דוח שנשכח במגירה." },
  { icon: HeartHandshake, title: "אמון הורים יומי", text: "הורים רואים עדכונים, מסמכים, סטטוס בטיחות ושקיפות מאושרת." },
  { icon: Bot, title: "תצפיתן דיגיטלי זהיר", text: "זיהוי חריגים והמלצות לבדיקה אנושית. בלי האשמות אוטומטיות ובלי חשיפת אירועים גולמיים." },
  { icon: Building2, title: "מערכת הפעלה לגן", text: "ילדים, צוות, מסמכים, הורים, מצלמות, משימות ותשלומים במסך עבודה אחד." }
];

const funnelSteps = [
  "מבינים את הפערים בגן",
  "קובעים הדגמה קצרה",
  "פותחים פיילוט",
  "הצוות עולה למערכת",
  "הגן מקבל סטנדרט שקיפות"
];

async function getHomeGardens() {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("gardens")
      .select("id, name, city, address, image_url, rating, owner_name, framework_type, ages, children_capacity, current_children_count, safe_status, last_inspection_score, last_inspection_at, next_inspection_at, manager:profiles!gardens_manager_id_fkey(full_name)")
      .eq("public_profile_enabled", true)
      .limit(3);
    return await Promise.all((data ?? []).map(async (garden: any) => ({ ...garden, supported_age_groups: await getKindergartenAgeGroups(supabase, garden.id, garden) })));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const homeGardens = await getHomeGardens();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "גן בטוח",
    url: "https://gan-batuach.vercel.app/",
    description: "פלטפורמת בטיחות, פיקוח ושקיפות לגני ילדים",
    areaServed: "Israel"
  };

  return (
    <>
      <BrandHeader />
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <MarketingHero
          eyebrow="תקן חדש לגני ילדים"
          title="גן בטוח – תקן הבטיחות, הפיקוח והשקיפות החדש לגני ילדים"
          subtitle="הפלטפורמה שמחברת גנים, הורים, צוות, פקחים ומצלמות למערכת אחת שמייצרת אמון, תיעוד ותפעול מקצועי."
          primaryHref="/book-demo"
          primaryLabel="קביעת הדגמה לגן"
          secondaryHref="/parents-demand"
          secondaryLabel="אני הורה"
        >
          <div className="authority-panel">
            <div><ShieldCheck /><strong>סטנדרט בטיחות</strong><span>פיקוח, תיקונים ושקיפות</span></div>
            <div><Camera /><strong>מצלמות מוגנות</strong><span>הרשאות צפייה בלבד</span></div>
            <div><Bot /><strong>AI לבדיקה אנושית</strong><span>המלצות, לא החלטות</span></div>
            <div><UsersRound /><strong>אמון הורים</strong><span>עדכונים ברורים מדי יום</span></div>
          </div>
        </MarketingHero>

        <section className="marketing-metrics-strip">
          <MarketingMetric label="מה ההורים מקבלים" value="שקיפות" text="סטטוס, עדכונים, מסמכים ותקשורת" />
          <MarketingMetric label="מה הגן מקבל" value="מערכת אחת" text="תפעול, צוות, הורים ופיקוח" />
          <MarketingMetric label="מה הפיקוח מקבל" value="תיעוד" text="ממצאים, תיקונים ודוחות" />
          <MarketingMetric label="מה העסק מקבל" value="אמון" text="יתרון מסחרי מול הורים" />
        </section>

        <MarketingSection eyebrow="Why Gan Batuach" title="לא עוד תוכנה לגן. סטנדרט אמון חדש." subtitle="גן בטוח הופכת בטיחות ושקיפות ליתרון עסקי, לא לעוד מטלה.">
          <div className="grid cols-4 feature-grid">
            {platformPillars.map((item) => <MarketingCard key={item.title} {...item} />)}
          </div>
        </MarketingSection>

        <MarketingSection eyebrow="Conversion Funnel" title="מהביקור באתר לפיילוט פעיל" subtitle="מסלול קצר וברור שמוריד חיכוך ומעביר גן מהתעניינות להתחלה.">
          <div className="conversion-funnel">
            {funnelSteps.map((step, index) => (
              <article key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </article>
            ))}
          </div>
        </MarketingSection>

        <section className="parent-pressure-band">
          <div>
            <span className="marketing-badge">Parent pressure</span>
            <h2>גן הילדים שלכם עדיין לא בגן בטוח?</h2>
            <p>הורים לא צריכים לנחש. בקשו מהגן שקיפות, סטטוס בטיחות, עדכונים יומיים ומעקב פיקוח ברור.</p>
          </div>
          <div className="actions">
            <Link className="button primary large" href="/parents-demand">דרשו שקיפות מהגן</Link>
            <Link className="button secondary large" href="/parent-portal">ראו מה הורים מקבלים</Link>
          </div>
        </section>

        <MarketingSection eyebrow="Authority" title="שלושה מנועי אמון במקום אחד">
          <div className="grid cols-3 feature-grid">
            <MarketingCard icon={ClipboardCheck} title="פיקוח ובקרה" text="תהליכי ביקורת, ממצאים, תיקון, חתימה ותיעוד לאורך זמן." />
            <MarketingCard icon={BarChart3} title="מדדי איכות" text="הכנה לציונים, דירוגים, מגמות ושקיפות ציבורית מאושרת." />
            <MarketingCard icon={Sparkles} title="טכנולוגיה אחראית" text="AI, מצלמות וניתוח סיכונים תחת review אנושי וגבולות פרטיות." />
          </div>
        </MarketingSection>

        <MarketingSection eyebrow="Participating Kindergartens" title="גנים שבוחרים לעבוד בשקיפות">
          {homeGardens.length === 0 ? (
            <div className="empty-state">
              <strong>רשימת הגנים הציבורית בהכנה</strong>
              <span>כאשר גן יאשר פרופיל ציבורי, הוא יוצג כאן עם badge וסטטוס מאושר.</span>
              <Link className="button primary" href="/book-demo">היו מהגנים הראשונים</Link>
            </div>
          ) : (
            <div className="garden-card-grid">
              {homeGardens.map((garden: any) => (
                <article className="public-garden-card" key={garden.id}>
                  {garden.image_url ? <img className="garden-card-image" src={garden.image_url} alt={garden.name} /> : <div className="garden-image-placeholder">{garden.name}</div>}
                  <div className="garden-card-top"><span className={garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.safe_status ?? "בתהליך"}</span><span><MapPin size={16} /> {garden.city}</span></div>
                  <h3>{garden.name}</h3>
                  <p>{garden.address ?? "כתובת לפי הרשאת הגן"} · {garden.manager?.full_name ?? garden.owner_name ?? "מנהלת הגן"}</p>
                  <div className="garden-facts">
                    <span>{formatAgeGroups(garden.supported_age_groups ?? [])}</span>
                    <span>{formatPublicPriceRange(garden.supported_age_groups ?? [])}</span>
                    <span>ציון ביקורת: {garden.last_inspection_score ?? "טרם פורסם"}</span>
                  </div>
                  <Link className="button primary" href={`/gardens/${garden.id}`}>צפייה בגן</Link>
                </article>
              ))}
            </div>
          )}
        </MarketingSection>

        <ConversionBand title="רוצים שהגן שלכם יהיה חלק מסטנדרט גן בטוח?" text="קבעו הדגמה קצרה. נראה איך הגן עובר מתפעול מפוזר למערכת אחת של בטיחות, שקיפות וניהול." />
      </main>
    </>
  );
}
