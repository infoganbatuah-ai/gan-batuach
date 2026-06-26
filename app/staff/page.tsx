import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, FileBadge2, MessageCircle, Search, ShieldCheck, UserCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ActionCard, DashboardGrid, PremiumCard, ResponsivePage, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";

export const metadata = {
  title: "צוות גן | גן בטוח",
  description: "עמוד הסבר ציבורי לצוותי גן: פרופיל, מועמדות, שיבוץ לגן, משמרות, נוכחות, מסמכים והודעות."
};

const staffBenefits = [
  { icon: UserCheck, title: "פרופיל צוות מסודר", text: "פרטים, ניסיון, תפקידים מועדפים ומסמכים נדרשים במקום אחד." },
  { icon: Search, title: "חיפוש גנים מגייסים", text: "צוות שאינו משויך יכול להגיש מועמדות לגן לפי עיר, תפקיד וגילאים." },
  { icon: CalendarClock, title: "משמרות ונוכחות", text: "לאחר אישור ושיוך לגן, הצוות רואה משמרות, כניסה ויציאה לפי ההרשאות." },
  { icon: MessageCircle, title: "תקשורת עם הגן", text: "הודעות ומשימות מול מנהלת הגן, בלי חשיפה למידע שאינו מורשה." }
];

export default function StaffPublicPage() {
  return (
    <>
      <BrandHeader />
      <ResponsivePage className="gb-public-page gb-role-public-page" size="lg">
        <section className="gb-public-hero gb-role-public-hero">
          <div className="gb-public-hero-copy">
            <StatusChip tone="info" icon={BriefcaseBusiness}>צוות גן</StatusChip>
            <h1>דרך נקייה להצטרף לגן ולעבוד מסודר.</h1>
            <p>
              צוות גן מקבל פרופיל אישי, מועמדויות, מסמכים, משמרות, נוכחות והודעות. גישה למידע פנימי נפתחת רק אחרי אישור ושיוך לגן פעיל.
            </p>
            <div className="gb-public-hero-actions">
              <Link className="gb-public-button primary large" href="/app/register/staff">הרשמה כאיש צוות</Link>
              <Link className="gb-public-button soft large" href="/app/register/staff">חיפוש גנים לאחר הרשמה</Link>
              <Link className="gb-public-button ghost large" href="/app/login">כניסה למערכת</Link>
            </div>
          </div>
          <PremiumCard className="gb-role-public-panel">
            <ShieldCheck size={44} />
            <h2>פרטי ילדים, הורים ומסמכים פנימיים אינם ציבוריים.</h2>
            <p>רק צוות שאושר ושויך לגן רואה את המידע המותר לו לפי תפקיד והרשאות.</p>
          </PremiumCard>
        </section>

        <section className="gb-public-section">
          <SectionHeader eyebrow="מה צוות מקבל?" title="חוויה תפעולית קצרה וברורה." subtitle="העמוד הציבורי מסביר את המסלול. העבודה עצמה מתבצעת בתוך דשבורד הצוות לאחר אישור." />
          <DashboardGrid min="230px">
            {staffBenefits.map((item) => <ActionCard key={item.title} icon={item.icon} title={item.title} text={item.text} href="/app/register/staff" tone="info" />)}
          </DashboardGrid>
        </section>

        <section className="gb-public-cta-band">
          <div>
            <StatusChip tone="success" icon={FileBadge2}>מסמכים ואישור</StatusChip>
            <h2>מתחילים בפרופיל, ממשיכים באישור גן.</h2>
            <p>הצוות לא מקבל גישה לגן, ילדים או הורים לפני אישור מנהלת ושיוך תקין.</p>
          </div>
          <div className="gb-public-hero-actions">
            <Link className="gb-public-button white" href="/app/register/staff">הרשמה לצוות</Link>
            <Link className="gb-public-button outline-white" href="/app">כניסה למערכת</Link>
          </div>
        </section>
      </ResponsivePage>
    </>
  );
}
