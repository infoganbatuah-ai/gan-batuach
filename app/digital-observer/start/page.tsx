import Image from "next/image";
import Link from "next/link";
import { Headphones, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { ObserverAuthDevicePreview } from "@/components/digital-observer/observer-auth-device-preview";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";

export default function DigitalObserverStartPage() {
  return <main className="do-auth-page light" dir="rtl">
    <section className="do-auth-form-wrap wide do-account-choice-wrap">
      <div className="do-auth-card do-account-choice-card">
        <Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>יצירת חשבון חדש</small></span></Link>
        <header><h1>יצירת חשבון</h1><p>בחרו את סוג החשבון המתאים לכם</p></header>
        <div className="do-account-type-grid">
          <Link className="do-choice do-account-type-card home" href="/digital-observer/register?type=home"><span className="do-account-type-visual" aria-hidden="true"><Image src="/assets/digital-observer/account-home-v1.png" alt="" width={700} height={700} priority /></span><strong>בית פרטי</strong><span>פתרון חכם להגנה על הבית והמשפחה</span><b>המשך למסלול ביתי</b></Link>
          <Link className="do-choice do-account-type-card business" href="/digital-observer/register?type=business"><span className="do-account-type-visual" aria-hidden="true"><Image src="/assets/digital-observer/account-business-v1.png" alt="" width={700} height={700} priority /></span><strong>עסק</strong><span>פתרון מתקדם לעסקים ולניהול מספר סניפים</span><b>המשך למסלול עסקי</b></Link>
        </div>
        <div className="do-account-values"><span><Headphones />תמיכה אנושית לאורך הדרך</span><span><Sparkles />גישה מאובטחת ומתקדמת</span><span><ShieldCheck />פרטיות קלה להבנה</span></div>
        <div className="do-notice info"><LockKeyhole /><span><strong>המידע שלכם נשאר פרטי ומאובטח.</strong> אנחנו לא משתפים מידע עם גורמים חיצוניים בלי הרשאה.</span></div>
        <p className="do-auth-switch">כבר רשומים? <Link href="/digital-observer/login">חזרה להתחברות</Link></p>
      </div>
    </section>
    <ObserverAuthDevicePreview screen="account-type" />
  </main>;
}
