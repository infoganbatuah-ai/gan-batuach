import Image from "next/image";
import Link from "next/link";
import { Baby, Building2, DoorOpen, LockKeyhole, PawPrint, UsersRound } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";

type PreviewProps = { screen: "login" | "account-type" | "home-onboarding" | "business-onboarding" };

const homePriorities = [
  [UsersRound, "משפחה"],
  [Baby, "ילדים"],
  [Baby, "תינוק"],
  [PawPrint, "חיות מחמד"],
  [DoorOpen, "כניסה ושער"]
] as const;

export function ObserverAuthDevicePreview({ screen }: PreviewProps) {
  return (
    <aside className={`do-auth-device-preview ${screen}`} aria-label="תצוגת ממשק מובייל">
      <div className="do-auth-device-speaker" aria-hidden="true" />
      <div className="do-auth-device-screen">
        <header><ObserverMark /><b>תצפיתן דיגיטלי</b></header>
        {screen === "login" ? (
          <>
            <section className="do-auth-device-hero"><ObserverMark /><strong>שקט נפשי, בכל רגע</strong><small>הבית שלכם, בשליטה מלאה.</small></section>
            <section className="do-auth-device-card"><b>התחברות</b><span>דוא״ל</span><span>סיסמה</span><Link href="/digital-observer/login">התחברות</Link></section>
          </>
        ) : screen === "account-type" ? (
          <>
            <section className="do-auth-device-title"><b>יצירת חשבון</b><small>בחרו את סוג החשבון המתאים לכם</small></section>
            <section className="do-auth-device-options">
              <Link href="/digital-observer/register?type=home"><Image src="/assets/digital-observer/account-home-v1.png" alt="" width={240} height={180} /><b>בית פרטי</b></Link>
              <Link href="/digital-observer/register?type=business"><Image src="/assets/digital-observer/account-business-v1.png" alt="" width={240} height={180} /><b>עסק</b></Link>
            </section>
            <p><LockKeyhole /> המידע שלכם נשאר פרטי ומאובטח</p>
          </>
        ) : screen === "home-onboarding" ? (
          <section className="do-auth-device-onboarding">
            <div className="do-auth-device-mini-stepper" aria-hidden="true"><i>1</i><span /><i>2</i><span /><i>3</i><span /><i>4</i></div>
            <strong>מה הכי חשוב לכם?</strong>
            <small>בחרו את הדברים החשובים בבית</small>
            <div className="do-auth-device-priorities">
              {homePriorities.map(([PriorityIcon, label]) => <span key={label}><PriorityIcon /><b>{label}</b><i aria-hidden="true" /></span>)}
            </div>
            <b className="do-auth-device-continue">המשך</b>
          </section>
        ) : (
          <section className="do-auth-device-onboarding business">
            <div className="do-auth-device-mini-stepper" aria-hidden="true"><i>1</i><span /><i>2</i><span /><i>3</i><span /><i>4</i></div>
            <Building2 className="do-auth-device-business-icon" />
            <strong>פרטי העסק</strong>
            <small>הגדירו את העסק ואת שעות הפעילות</small>
            <div className="do-auth-device-business-fields" aria-hidden="true">
              <span>שם העסק</span><span>סוג העסק</span>
              <span className="wide">מספר מצלמות משוער</span>
              <div className="do-auth-device-days"><i>א׳</i><i>ב׳</i><i>ג׳</i><i>ד׳</i><i>ה׳</i><i>ו׳</i><i>ש׳</i></div>
              <span>08:00</span><span>18:00</span>
            </div>
            <b className="do-auth-device-continue">המשך</b>
          </section>
        )}
      </div>
    </aside>
  );
}
