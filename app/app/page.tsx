import Link from "next/link";
import { ArrowLeft, BarChart3, Download, LogIn, MonitorSmartphone, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { ResponsivePage } from "@/components/gan-batuach-design-system";
import { GanBatuachBrand } from "@/components/gan-batuach-brand";

export const metadata = {
  title: "כניסה למערכת | גן בטוח",
  description: "שער הכניסה לאפליקציית גן בטוח: הורדת אפליקציה, המשך בדפדפן, התחברות והרשמה עצמית."
};

export default function AppGatewayPage() {
  return (
    <main className="app-gateway-page gb-app-entry-page" dir="rtl">
      <ResponsivePage size="lg" className="gb-app-entry-inner">
        <section className="gb-welcome-card" aria-labelledby="gb-welcome-title">
          <div className="gb-welcome-photo" role="img" aria-label="מרחב גן ילדים מואר ובטוח">
            <div className="gb-welcome-photo-badge"><ShieldCheck /> סביבת ניהול בטוחה</div>
          </div>
          <div className="gb-welcome-copy">
            <div className="gb-welcome-topbar">
              <GanBatuachBrand />
              <Link className="gb-welcome-login" href="/app/login"><LogIn /> התחברות</Link>
            </div>
            <div className="gb-welcome-message">
              <p className="eyebrow">הגן שלך. המקום הבטוח שלהם.</p>
              <h1 id="gb-welcome-title">ברוכים הבאים<br />לגן בטוח</h1>
              <p>הפלטפורמה המובילה לניהול גנים, הורים וצוות — בביטחון, בשקיפות ובשקט.</p>
              <div className="gb-welcome-benefits" aria-label="יתרונות המערכת">
                <span><ShieldCheck /> בטיחות ושקט בכל יום</span>
                <span><UsersRound /> שיתוף וקשר עם ההורים</span>
                <span><BarChart3 /> ניהול חכם ופשוט</span>
              </div>
              <Link className="gb-public-button primary large gb-welcome-primary" href="/app/register">
                <UserPlus size={19} /> מתחילים עכשיו <ArrowLeft size={19} />
              </Link>
              <p className="gb-welcome-existing">כבר יש לך חשבון? <Link href="/app/login">להתחברות</Link></p>
            </div>
            <div className="gb-welcome-footer">
              <button type="button" disabled title="קישורי החנויות יופעלו לאחר אישור App Store ו-Google Play"><Download /> אפליקציה בקרוב</button>
              <Link href="/digital-observer"><MonitorSmartphone /> מידע על Digital Observer</Link>
            </div>
          </div>
        </section>
      </ResponsivePage>
    </main>
  );
}
