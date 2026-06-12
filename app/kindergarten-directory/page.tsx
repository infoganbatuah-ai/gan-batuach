import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";

export const metadata = {
  title: "מדריך גנים | גן בטוח",
  description: "מדריך ציבורי עתידי לגנים משתתפים, badges, ציונים וסטטוס שקיפות מאושר."
};

export default function KindergartenDirectoryPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero">
          <p className="eyebrow">Public Directory</p>
          <h1>מדריך הגנים של גן בטוח</h1>
          <p>תשתית עתידית להצגת גנים משתתפים, badge אמון, דירוגים ופרופילים ציבוריים מאושרים בלבד.</p>
        </section>
        <section className="section compact-section">
          <div className="empty-state">
            <Building2 size={34} />
            <h2>המדריך הציבורי בהכנה</h2>
            <p>בינתיים אפשר לראות גנים שאישרו פרופיל ציבורי ברשימת הגנים הקיימת.</p>
            <div className="actions">
              <Link className="button primary" href="/gardens"><ShieldCheck size={16} /> צפייה בגנים</Link>
              <Link className="button secondary" href="/book-demo">הצטרפות גן</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
