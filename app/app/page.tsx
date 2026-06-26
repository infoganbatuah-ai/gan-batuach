import Image from "next/image";
import Link from "next/link";
import { Download, LogIn, MonitorSmartphone, UserPlus } from "lucide-react";
import { PremiumCard, ResponsivePage, StatusChip } from "@/components/gan-batuach-design-system";

export const metadata = {
  title: "כניסה למערכת | גן בטוח",
  description: "שער הכניסה לאפליקציית גן בטוח: הורדת אפליקציה, המשך בדפדפן, התחברות והרשמה עצמית."
};

export default function AppGatewayPage() {
  return (
    <main className="app-gateway-page gb-app-entry-page" dir="rtl">
      <ResponsivePage size="md" className="gb-app-entry-inner">
        <section className="app-gateway-hero gb-app-entry-hero">
          <Link className="app-auth-back" href="/">חזרה לאתר</Link>
          <div className="app-gateway-brand">
            <Image src="/assets/company-symbol.png" alt="" width={72} height={72} priority />
            <Image src="/assets/company-name.png" alt="גן בטוח" width={164} height={42} priority />
          </div>
          <div>
            <StatusChip tone="primary" icon={MonitorSmartphone}>כניסה למערכת</StatusChip>
            <h1>ברוכים הבאים לגן בטוח</h1>
            <p>הורידו את האפליקציה או המשיכו בדפדפן. המערכת תעביר כל משתמש למסך המתאים לפי התפקיד והסטטוס שלו.</p>
          </div>
          <div className="app-gateway-actions">
            <button className="gb-public-button soft large" type="button" disabled title="קישורי החנויות יופעלו לאחר אישור App Store ו-Google Play">
              <Download size={18} /> הורדת אפליקציה
            </button>
            <Link className="gb-public-button primary large" href="/app/login">
              <MonitorSmartphone size={18} /> המשך בדפדפן
            </Link>
          </div>
          <div className="notice app-gateway-note">האפליקציה תעלה בקרוב. ניתן להמשיך בדפדפן כבר עכשיו.</div>
        </section>

        <section className="app-gateway-grid">
          <PremiumCard className="app-gateway-card" href="/app/login">
            <LogIn />
            <strong>משתמש קיים</strong>
            <span>התחברות למערכת והעברה אוטומטית לדשבורד המתאים.</span>
          </PremiumCard>
          <PremiumCard className="app-gateway-card" href="/app/register">
            <UserPlus />
            <strong>משתמש חדש</strong>
            <span>בחירת מסלול: הורה, מנהלת גן, צוות גן או מפקח.</span>
          </PremiumCard>
          <PremiumCard className="app-gateway-card" href="/digital-observer">
            <MonitorSmartphone />
            <strong>Digital Observer</strong>
            <span>עמוד המוצר הציבורי של התצפיתן הדיגיטלי. כניסה לאפליקציה רק לאחר הרשאה.</span>
          </PremiumCard>
        </section>
      </ResponsivePage>
    </main>
  );
}
