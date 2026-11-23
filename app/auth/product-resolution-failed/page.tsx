import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "לא ניתן לאמת את סביבת החשבון",
  description: "מסך עצירה בטוח כאשר שיוך המוצר אינו זמין."
};

export default function ProductResolutionFailedPage() {
  return (
    <main className="do-route-state" dir="rtl" role="alert">
      <span className="do-route-state-mark"><ShieldAlert /></span>
      <h1>לא ניתן לאמת כרגע את סביבת החשבון</h1>
      <p>לא בוצעה כניסה ולא שונתה סיסמה. נסו שוב לאחר שהחיבור לשירות החשבונות חוזר.</p>
      <div className="button-row">
        <Link className="button primary" href="/digital-observer/login">כניסה לתצפיתן דיגיטלי</Link>
        <Link className="button secondary" href="/app/login">כניסה לגן בטוח</Link>
      </div>
    </main>
  );
}
