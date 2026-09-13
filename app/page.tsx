import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  HeartHandshake,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UsersRound
} from "lucide-react";
import {
  ActionCard,
  DashboardGrid,
  EmptyState,
  PremiumCard,
  ResponsivePage,
  SectionHeader,
  StatusChip
} from "@/components/gan-batuach-design-system";
import { formatAgeGroups, formatPublicPriceRange, getKindergartenAgeGroups } from "@/lib/kindergarten-age-groups";
import { createAdminClient } from "@/lib/supabase/admin";
import { BrandHeader } from "@/components/brand-header";
import { ArticleCarousel } from "@/components/editorial/article-carousel";
import { getPublishedArticles } from "@/lib/editorial/store";
import { SITE_URL } from "@/lib/editorial/articles";
import type { KindergartenAgeGroup } from "@/lib/kindergarten-age-groups";
import "./articles/articles.css";

type HomeGarden = {
  id: string; name: string; city: string; address?: string | null;
  image_url?: string | null; safe_status?: string | null;
  supported_age_groups?: KindergartenAgeGroup[];
};

export const metadata = {
  title: { absolute: "גן בטוח | תו תקן פרטי ומערכת לניהול גני ילדים" },
  description: "גן בטוח מחבר תו תקן פרטי לגני ילדים, בקרה ופיקוח, מערכת לניהול גן ילדים מקצה לקצה ופורטל הורים. מידע ברור על בטיחות ושקיפות.",
  alternates: { canonical: SITE_URL },
  openGraph: { title: "גן בטוח | תו תקן פרטי ומערכת לניהול גני ילדים", description: "ניהול גן ילדים מקצה לקצה, בקרה ופיקוח ופורטל הורים במקום אחד.", url: SITE_URL, images: ["/assets/hero-control-center.png"] },
  twitter: { card: "summary_large_image" as const }
};

const heroPills = [
  "מיזם ישראלי",
  "תו תקן פרטי",
  "מצלמות וניטור",
  "פיקוח חודשי",
  "ניהול גן מלא",
  "ממשק הורים"
];

const moduleCards = [
  { icon: Building2, title: "דשבורד גננת", text: "ילדים, צוות, נוכחות, מסמכים ותשלומים בממשק אחד.", href: "/join-kindergarten", tone: "primary" as const },
  { icon: HeartHandshake, title: "דשבורד הורים", text: "כרטיס ילד, עדכונים, תשלומים, הודעות ובקשות הצטרפות.", href: "/parents", tone: "success" as const },
  { icon: UsersRound, title: "דשבורד צוות", text: "משמרות, נוכחות, משימות, מסמכים ותקשורת עם הגן.", href: "/staff", tone: "info" as const },
  { icon: ClipboardCheck, title: "דשבורד מפקח", text: "ביקורת חודשית, ליקויים, תיקונים ודוחות מסודרים.", href: "/join-inspector", tone: "info" as const },
  { icon: Bot, title: "תצפיתן דיגיטלי", text: "AI זהיר במצב shadow עם בדיקה אנושית לפני פעולה.", href: "/digital-observer", tone: "warning" as const }
];

const trustReasons = [
  { icon: ShieldCheck, title: "בטיחות לפני הכול", text: "תיעוד פיקוח, סטטוס תיקון ושקיפות שמקטינה אי ודאות." },
  { icon: Camera, title: "מצלמות עם גבולות", text: "צפייה בהרשאות, בלי חשיפת כתובות חיבור או סודות מצלמה." },
  { icon: MessageCircle, title: "תקשורת מסודרת", text: "הודעות, עדכונים ופעולות להורה ולגן במקום אחד." },
  { icon: BarChart3, title: "נתונים ברורים", text: "מדדים, בקשות, סטטוס מנוי ותפעול בלי עומס מיותר." },
  { icon: CalendarCheck, title: "שגרה יומית", text: "נוכחות, לו״ז, פעילות, צוות ומשימות בצורה פשוטה." },
  { icon: Sparkles, title: "חוויה פרימיום", text: "אפליקציה נקייה, עברית מלאה ופעולות קצרות וברורות." }
];

async function getHomeGardens() {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("gardens")
      .select("id, name, city, address, image_url, rating, owner_name, framework_type, ages, children_capacity, current_children_count, safe_status, last_inspection_score, last_inspection_at, next_inspection_at, manager:profiles!gardens_manager_id_fkey(full_name)")
      .eq("public_profile_enabled", true)
      .limit(3);
    return await Promise.all((data ?? []).filter((garden: HomeGarden) => !/\[demo\]|\bdemo\b/i.test(garden.name)).map(async (garden: HomeGarden) => ({ ...garden, supported_age_groups: await getKindergartenAgeGroups(supabase, garden.id, garden) })));
  } catch {
    return [];
  }
}

function HeroVisual() {
  return (
    <div className="gb-public-hero-visual" aria-hidden="true">
      <div className="gb-public-orbit-card top">
        <ShieldCheck size={24} />
        <span>בטיחות</span>
      </div>
      <div className="gb-public-logo-medallion">
        <Image src="/assets/company-symbol.png" alt="" width={118} height={118} />
      </div>
      <div className="gb-public-orbit-card left">
        <Camera size={24} />
        <span>ניטור</span>
      </div>
      <div className="gb-public-orbit-card right">
        <UsersRound size={24} />
        <span>הורים</span>
      </div>
      <div className="gb-public-floating-panel">
        <b>100%</b>
        <span>תהליך מסודר לגן, הורים וצוות</span>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const [homeGardens, articles] = await Promise.all([getHomeGardens(), getPublishedArticles()]);
  const structuredData = [
    { "@context": "https://schema.org", "@type": "Organization", name: "גן בטוח", url: SITE_URL, description: "תו תקן פרטי, מערכת ניהול ובקרה לגני ילדים", areaServed: "IL" },
    { "@context": "https://schema.org", "@type": "WebSite", name: "גן בטוח", url: SITE_URL, inLanguage: "he-IL" },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "גן בטוח", applicationCategory: "BusinessApplication", operatingSystem: "Web", description: "מערכת לניהול גני ילדים: רישום, צוות, הורים, מסמכים ובקרה", url: SITE_URL }
  ];

  return (
    <>
      <BrandHeader />
      <ResponsivePage className="gb-public-page" size="lg">
        {structuredData.map((schema, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />)}

        <section className="gb-public-hero">
          <div className="gb-public-hero-copy">
            <StatusChip tone="primary" icon={Sparkles}>תו תקן פרטי לגני ילדים</StatusChip>
            <h1>
              גן בטוח: ניהול גני ילדים <span>מקצה לקצה</span>
            </h1>
            <p>
              מיזם ישראלי המשלב תו תקן פרטי לגני ילדים, בקרה ופיקוח, מערכת ניהול מלאה ופורטל הורים.
              מנהלות, צוות והורים מקבלים מידע ותהליכים ברורים ליצירת סדר, אמון ושקיפות.
            </p>
            <div className="gb-public-hero-actions">
              <Link className="gb-public-button primary large" href="/app/register">רישום למערכת</Link>
              <Link className="gb-public-button ghost large" href="/app/login">כניסה למערכת</Link>
              <Link className="gb-public-button soft large" href="/book-demo">קביעת הדגמה</Link>
              <Link className="gb-public-button soft large" href="/kindergarten-directory">רשימת גני הילדים</Link>
              <Link className="gb-public-button soft large" href="/articles">כתבות ומדריכים</Link>
            </div>
            <div className="gb-public-pill-row">
              {heroPills.map((pill) => <span key={pill}>{pill}</span>)}
            </div>
          </div>
          <HeroVisual />
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="מהו גן בטוח?" title="לא רק מערכת: סטנדרט עבודה שמתעד גם את מה שקורה בין ביקורים" subtitle="תו התקן הפרטי של גן בטוח נועד לגנים שבוחרים בניהול, בקרה ופיקוח מתמשכים. הוא אינו רישיון ממשלתי, תעודה של מכון התקנים או תחליף לפיקוח המדינה." action={<Link className="gb-public-button soft" href="/safety-standard">על תו התקן</Link>} />
          <DashboardGrid min="240px">
            <PremiumCard><h3>למה צריך סטנדרט נוסף?</h3><p>רישוי הוא בסיס חשוב; תיעוד שוטף של בדיקות, טיפול בליקויים וקשר עם ההורים מסייע להראות איך הגן מתנהל לאורך השנה.</p></PremiumCard>
            <PremiumCard><h3>בקרה ופיקוח לגני ילדים</h3><p>מודל של ביקורת חודשית, מפקח ייעודי לגן, קשר רציף ותיעוד ממצא עד לאימות התיקון. בדקו בפועל מתי נערכה הביקורת האחרונה.</p></PremiumCard>
            <PremiumCard><h3>פורטל גני ילדים והורים</h3><p>מידע ציבורי שאושר לפרסום, לצד כלים להורים, לגננת ולצוות. דירוג או חוות דעת אינם מחליפים ביקור אישי ובדיקת רישוי.</p></PremiumCard>
          </DashboardGrid>
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="כלים שמשרתים את היום־יום" title="מה מקבלים במערכת לניהול גן ילדים?" subtitle="הכלים מוצגים לפי הצורך של כל גן והרשאות המשתמשים; זמינות מצלמות ונתונים ציבוריים תלויה בהגדרות ובהתאמה לדין." action={<Link className="gb-public-button soft" href="/join-kindergarten">ניהול גן</Link>} />
          <DashboardGrid min="240px">
            <PremiumCard><h3>רישום וכרטיס ילד</h3><p>רישום ילדים, פרטי קשר וכרטיס דיגיטלי למידע חיוני כמו אלרגיות, רגישויות, רקע מהגן הקודם והערות צוות רלוונטיות — לפי הרשאות.</p></PremiumCard>
            <PremiumCard><h3>הורים וצוות מחוברים</h3><p>כניסה נפרדת לצוות ולהורים, הודעות, נוכחות, משמרות, מסמכים ותשלומים כדי שהמידע החשוב לא ילך לאיבוד.</p></PremiumCard>
            <PremiumCard><h3>מצלמות ותצפיתן דיגיטלי</h3><p>התממשקות למצלמות הגן בכפוף לדין ולהרשאות. התצפיתן הדיגיטלי נמצא בבדיקות מבוקרות ומספק אינדיקציות לבדיקה אנושית, לא קביעה אוטומטית.</p></PremiumCard>
            <PremiumCard><h3>צוות, למידה ואיכות</h3><p>מעקב אחר מסמכים, הכשרות, השתלמויות ויעדי למידה, לצד ממצאי ביקורת וציון איכות כשיש נתונים מאומתים. אישורי העסקה נבדקים במסלול המוסמך בלבד.</p></PremiumCard>
          </DashboardGrid>
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="למי זה עוזר?" title="אותה תמונה מסודרת, לכל מי שאחראי לילדים" />
          <DashboardGrid min="200px">
            {[
              ["להורים", "מידע מאושר, שאלות טובות לבחירת גן וערוץ תקשורת ברור."],
              ["לגננת", "רישום, משימות, מסמכים ומעקב אחר ממצאים במקום אחד."],
              ["לצוות", "מידע חיוני על הילד, משמרות ועדכונים בהתאם לתפקיד."],
              ["לילדים", "רצף טיפולי טוב יותר כשמידע חיוני מגיע לאנשי הצוות הנכונים."],
              ["לבעלי הגן", "מבט על תפעול, תהליכי איכות וקשר עם המפקח והמשפחות."]
            ].map(([title, text]) => <PremiumCard key={title}><h3>{title}</h3><p>{text}</p></PremiumCard>)}
          </DashboardGrid>
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="מה כוללת המערכת?" title="כל תפקיד מקבל מסך פשוט, ברור ואפליקטיבי." subtitle="המערכת שומרת על הפרדה בין הרשאות, תפקידים ותהליכים, אבל מרגישה כמו אפליקציה אחת." />
          <DashboardGrid min="220px">
            {moduleCards.map((item) => (
              <ActionCard key={item.title} icon={item.icon} title={item.title} text={item.text} href={item.href} tone={item.tone} />
            ))}
          </DashboardGrid>
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="למה גן בטוח?" title="שקט להורים. סדר לצוות. שליטה למנהלת." />
          <DashboardGrid min="240px">
            {trustReasons.map((reason) => (
              <PremiumCard key={reason.title} className="gb-public-reason-card">
                <span><reason.icon size={24} /></span>
                <h3>{reason.title}</h3>
                <p>{reason.text}</p>
              </PremiumCard>
            ))}
          </DashboardGrid>
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="לומדים לפני שבוחרים" title="כתבות על גן ילדים בטוח, מומלץ ומפוקח" subtitle="מדריכים לבחירת גן, הבנת חוות דעת ודירוגים, מצלמות, רישום ובקרת איכות." action={<Link className="gb-public-button soft" href="/articles">לכל הכתבות</Link>} />
          <ArticleCarousel articles={articles.map(({ slug, title, summary }) => ({ slug, title, summary }))} />
        </section>

        <section className="gb-public-cta-band">
          <div>
            <StatusChip tone="success" icon={CheckCircle2}>מוכן להתחלה</StatusChip>
            <h2>רוצים לראות איך גן בטוח עובד אצלכם?</h2>
            <p>התחילו ברישום קצר או קבעו הדגמה. בלי הפעלה ציבורית, בלי חיוב חי, ובלי חשיפת מידע רגיש.</p>
          </div>
          <div className="gb-public-hero-actions">
            <Link className="gb-public-button white" href="/app/register">הרשמה עכשיו</Link>
            <Link className="gb-public-button outline-white" href="/book-demo">קביעת הדגמה</Link>
          </div>
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="רשימת גנים" title="גנים שבוחרים לעבוד בשקיפות" subtitle="רק מידע ציבורי שאושר להצגה מופיע כאן." action={<Link className="gb-public-button soft" href="/kindergarten-directory">לכל הגנים</Link>} />
          {homeGardens.length === 0 ? (
            <EmptyState icon={Building2} title="רשימת הגנים הציבורית בהכנה" text="כאשר גן יאשר פרופיל ציבורי, הוא יוצג כאן עם סטטוס, עיר, קבוצות גיל ונתונים ציבוריים בלבד." action={<Link className="gb-public-button primary" href="/join-kindergarten">הצטרפות גן</Link>} />
          ) : (
            <DashboardGrid min="280px">
              {homeGardens.map((garden) => (
                <PremiumCard key={garden.id} className="gb-public-home-garden-card" href={`/gardens/${garden.id}`}>
                  <div className="gb-public-garden-thumb">{garden.image_url ? <Image src={garden.image_url} alt={garden.name} width={560} height={320} unoptimized /> : <Building2 size={34} />}</div>
                  <StatusChip tone={garden.safe_status === "safe" ? "success" : "warning"} icon={ShieldCheck}>{garden.safe_status === "safe" ? "גן בטוח" : "בתהליך"}</StatusChip>
                  <h3>{garden.name}</h3>
                  <p><MapPin size={16} /> {garden.city} · {garden.address ?? "כתובת לפי הרשאת הגן"}</p>
                  <small>{formatAgeGroups(garden.supported_age_groups ?? [])}</small>
                  <b>{formatPublicPriceRange(garden.supported_age_groups ?? [])}</b>
                </PremiumCard>
              ))}
            </DashboardGrid>
          )}
        </section>
      </ResponsivePage>
    </>
  );
}
