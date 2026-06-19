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

export const metadata = {
  title: "גן בטוח | תקן הבטיחות, הפיקוח והשקיפות החדש לגני ילדים",
  description: "גן בטוח היא פלטפורמת בטיחות, פיקוח, שקיפות וניהול לגני ילדים. הורים מקבלים אמון, גנים מקבלים מערכת תפעול, ופיקוח מקבל תיעוד."
};

const heroPills = [
  "פטנט ישראלי",
  "תו תקן חדש",
  "מצלמות וניטור",
  "פיקוח חודשי",
  "ניהול גן מלא",
  "ממשק הורים"
];

const moduleCards = [
  { icon: Building2, title: "ניהול גן", text: "ילדים, צוות, נוכחות, מסמכים ותשלומים בממשק אחד.", href: "/join-kindergarten", tone: "primary" as const },
  { icon: HeartHandshake, title: "ממשק הורים", text: "כרטיס ילד, עדכונים, תשלומים, הודעות ובקשות הצטרפות.", href: "/parents", tone: "success" as const },
  { icon: ClipboardCheck, title: "פיקוח וביקורות", text: "ביקורת חודשית, ליקויים, תיקונים ודוחות מסודרים.", href: "/safety-standard", tone: "info" as const },
  { icon: Bot, title: "תצפיתן דיגיטלי", text: "AI זהיר במצב shadow עם בדיקה אנושית לפני פעולה.", href: "/digital-observer", tone: "warning" as const }
];

const trustReasons = [
  { icon: ShieldCheck, title: "בטיחות לפני הכול", text: "תיעוד פיקוח, סטטוס תיקון ושקיפות שמקטינה אי ודאות." },
  { icon: Camera, title: "מצלמות עם גבולות", text: "צפייה בהרשאות, בלי חשיפת כתובות RTSP או סודות מצלמה." },
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
    return await Promise.all((data ?? []).map(async (garden: any) => ({ ...garden, supported_age_groups: await getKindergartenAgeGroups(supabase, garden.id, garden) })));
  } catch {
    return [];
  }
}

function PublicHeader() {
  return (
    <header className="gb-public-header">
      <Link href="/" className="gb-public-brand" aria-label="גן בטוח">
        <Image src="/assets/company-symbol.png" alt="" width={48} height={48} />
        <Image src="/assets/company-name.png" alt="גן בטוח" width={146} height={46} />
      </Link>
      <nav aria-label="ניווט ציבורי">
        <Link href="/kindergarten-directory">רשימת גנים</Link>
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
      <PublicHeader />
      <ResponsivePage className="gb-public-page" size="lg">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

        <section className="gb-public-hero">
          <div className="gb-public-hero-copy">
            <StatusChip tone="primary" icon={Sparkles}>תקן חדש לגני ילדים</StatusChip>
            <h1>
              הפטנט הישראלי לניהול גני ילדים <span>מקצה לקצה</span>
            </h1>
            <p>
              מערכת אחת שמחברת מנהלות, הורים, צוות, פיקוח, מצלמות, מסמכים ותשלומים לחוויית שימוש פשוטה,
              שקופה ובטוחה.
            </p>
            <div className="gb-public-hero-actions">
              <Link className="gb-public-button primary large" href="/app/register">הרשמה בחינם</Link>
              <Link className="gb-public-button ghost large" href="/app/login">התחברות</Link>
              <Link className="gb-public-button soft large" href="/book-demo">קביעת הדגמה</Link>
            </div>
            <div className="gb-public-pill-row">
              {heroPills.map((pill) => <span key={pill}>{pill}</span>)}
            </div>
          </div>
          <HeroVisual />
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
              {homeGardens.map((garden: any) => (
                <PremiumCard key={garden.id} className="gb-public-home-garden-card" href={`/gardens/${garden.id}`}>
                  <div className="gb-public-garden-thumb">{garden.image_url ? <img src={garden.image_url} alt={garden.name} /> : <Building2 size={34} />}</div>
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
