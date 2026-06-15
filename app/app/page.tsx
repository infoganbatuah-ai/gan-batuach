import Image from "next/image";
import Link from "next/link";
import { Download, LogIn, MonitorSmartphone, UserPlus } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";

export const metadata = {
  title: "כניסה למערכת | גן בטוח",
  description: "שער הכניסה לאפליקציית גן בטוח: הורדת אפליקציה, המשך בדפדפן, התחברות והרשמה עצמית."
};

export default function AppGatewayPage() {
  return (
    <>
      <BrandHeader />
      <main className="app-gateway-page">
        <section className="app-gateway-hero">
          <div className="app-gateway-brand">
            <Image src="/assets/company-symbol.png" alt="" width={72} height={72} priority />
            <Image src="/assets/company-name.png" alt="גן בטוח" width={164} height={42} priority />
          </div>
          <div>
            <p className="eyebrow">כניסה למערכת</p>
            <h1>ברוכים הבאים לגן בטוח</h1>
            <p>הורידו את האפליקציה או המשיכו בדפדפן. המערכת תעביר כל משתמש למסך המתאים לפי התפקיד והסטטוס שלו.</p>
          </div>
          <div className="app-gateway-actions">
            <button className="button secondary large" type="button" disabled title="קישורי החנויות יופעלו לאחר אישור App Store ו-Google Play">
              <Download size={18} /> הורדת אפליקציה
            </button>
            <Link className="button primary large" href="/app/login">
              <MonitorSmartphone size={18} /> המשך בדפדפן
            </Link>
          </div>
          <div className="notice app-gateway-note">האפליקציה תעלה בקרוב. ניתן להמשיך בדפדפן כבר עכשיו.</div>
        </section>

        <section className="app-gateway-grid">
          <Link className="app-gateway-card" href="/app/login">
            <LogIn />
            <strong>משתמש קיים</strong>
            <span>התחברות למערכת והעברה אוטומטית לדשבורד המתאים.</span>
          </Link>
          <Link className="app-gateway-card" href="/app/register">
            <UserPlus />
            <strong>משתמש חדש</strong>
            <span>בחירת מסלול: הורה, מנהלת גן, צוות גן או מפקח.</span>
          </Link>
          <Link className="app-gateway-card" href="/digital-observer/dashboard">
            <MonitorSmartphone />
            <strong>Digital Observer</strong>
            <span>כניסה למוצר התצפיתן הדיגיטלי עבור אתרים, מצלמות והתראות.</span>
          </Link>
        </section>
      </main>
    </>
  );
}
