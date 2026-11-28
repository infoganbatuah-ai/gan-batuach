import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AppAuthShell } from "@/components/app-auth-shell";

export const metadata = {
  title: "אין שיוך לגן בטוח",
  description: "החשבון מאומת, אך אינו משויך לתפקיד או לגן במערכת גן בטוח."
};

export default function GanBatuachAccessNotProvisionedPage() {
  return (
    <AppAuthShell
      eyebrow="הפרדת מוצרים מאובטחת"
      title="החשבון אינו משויך לגן בטוח"
      subtitle="חשבון תצפיתן דיגיטלי אינו יוצר אוטומטית חשבון הורה. גישה לגן בטוח נפתחת רק לאחר הרשמה או הזמנה מפורשת."
    >
      <section className="gb-recovery-card">
        <div className="gb-state-orb" aria-hidden="true"><ShieldAlert /></div>
        <p>לא נוצרו עבורכם ילד, גן או הרשאת הורה. אם קיבלתם הזמנה מגן, פתחו את קישור ההזמנה המקורי.</p>
        <Link className="button primary large" href="/digital-observer/login">מעבר לתצפיתן דיגיטלי</Link>
        <Link className="button secondary" href="/app/register">הרשמה מפורשת לגן בטוח</Link>
      </section>
    </AppAuthShell>
  );
}
