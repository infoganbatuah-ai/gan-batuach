import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Building2,
  Check,
  Eye,
  Heart,
  Lock,
  Mail,
  MessageCircle,
  School,
  ShieldCheck,
  User,
  Users
} from "lucide-react";
import { signIn } from "@/app/login/actions";
import { LoginSubmitButton } from "@/components/auth-submit-button";
import { dashboardPathForProfile, getSessionProfile } from "@/lib/auth";
import { isRole } from "@/lib/roles";

type LoginSearchParams = { error?: string; next?: string; gardenId?: string; audience?: string };

export async function AppLoginScreen({ searchParams }: { searchParams?: Promise<LoginSearchParams> }) {
  const params = await searchParams;
  const { profile } = await getSessionProfile();
  if (profile?.role && isRole(profile.role)) redirect(await dashboardPathForProfile(profile));

  return (
    <main className="gb-reference-login" dir="rtl">
      <div className="gb-reference-login-inner">
        <section className="gb-reference-brand-stage" aria-label="גן בטוח">
          <div className="gb-orbit-ring gb-orbit-ring-one" />
          <div className="gb-orbit-ring gb-orbit-ring-two" />
          <span className="gb-soft-cloud gb-soft-cloud-a" />
          <span className="gb-soft-cloud gb-soft-cloud-b" />
          <span className="gb-soft-dot gb-soft-dot-a" />
          <span className="gb-soft-dot gb-soft-dot-b" />
          <span className="gb-soft-dot gb-soft-dot-c" />

          <div className="gb-floating-icon gb-floating-icon-users"><Users size={42} /></div>
          <div className="gb-floating-icon gb-floating-icon-school"><Building2 size={42} /></div>
          <div className="gb-floating-icon gb-floating-icon-user"><User size={34} /></div>
          <div className="gb-floating-icon gb-floating-icon-chart"><BarChart3 size={35} /></div>
          <div className="gb-floating-icon gb-floating-icon-lock"><Lock size={34} /></div>
          <div className="gb-floating-icon gb-floating-icon-shield"><ShieldCheck size={37} /></div>

          <div className="gb-reference-logo-mark">
            <Image src="/assets/company-symbol.png" alt="" width={236} height={236} priority />
          </div>
          <Image className="gb-reference-logo-name" src="/assets/company-name.png" alt="גן בטוח" width={420} height={112} priority />
          <p>סביבה בטוחה. חיבורים שמחזיקים. עתיד טוב יותר.</p>
          <Heart className="gb-reference-heart" size={31} fill="currentColor" />
        </section>

        <section className="gb-reference-login-card" aria-labelledby="login-title">
          <header className="gb-reference-login-heading">
            <h1 id="login-title">התחברות למערכת</h1>
            <p>הזינו את הפרטים שלכם והמערכת תזהה את סוג החשבון שלכם</p>
          </header>

          <form className="gb-reference-login-form" action={signIn}>
            {params?.error ? <p className="error-banner">{params.error}</p> : null}
            <input type="hidden" name="context_garden_id" value={params?.gardenId ?? ""} />
            <input type="hidden" name="auth_source" value="app" />

            <label className="gb-reference-field">
              <span className="sr-only">אימייל או טלפון</span>
              <input name="email" type="email" required placeholder="אימייל או טלפון" autoComplete="username" />
              <span className="gb-reference-field-icon"><Mail size={28} /></span>
            </label>

            <label className="gb-reference-field">
              <span className="sr-only">סיסמה</span>
              <input name="password" type="password" required placeholder="סיסמה" autoComplete="current-password" />
              <span className="gb-reference-field-icon"><Lock size={27} /></span>
              <span className="gb-reference-field-eye" aria-hidden="true"><Eye size={27} /></span>
            </label>

            <div className="gb-reference-login-options">
              <label>
                <input type="checkbox" name="remember" value="1" />
                <span>זכור אותי</span>
              </label>
              <Link href="/forgot-password">שכחתי סיסמה</Link>
            </div>

            <LoginSubmitButton />

            <div className="gb-reference-divider"><span>או התחברו בדרך נוספת</span></div>

            <div className="gb-reference-alt-actions">
              <Link className="gb-reference-alt-button" href="/forgot-password">
                <MessageCircle size={29} />
                <span>כניסה עם קוד חד-פעמי</span>
              </Link>
            </div>
          </form>

          <p className="gb-reference-register-line">אין לכם חשבון? <Link href="/app/register">הרשמה</Link></p>

          <aside className="gb-reference-security-card" aria-label="כניסה אחת לכל סוגי המשתמשים">
            <div className="gb-reference-security-illustration">
              <span><Lock size={44} /></span>
              <i><Check size={34} /></i>
            </div>
            <div>
              <h2>כניסה אחת לכל סוגי המשתמשים</h2>
              <p>הורים, גנים, צוות, מפקחים ואדמין — המערכת תזהה את החשבון לאחר ההתחברות</p>
            </div>
            <div className="gb-reference-security-shield"><ShieldCheck size={86} /></div>
          </aside>

          <Link className="gb-reference-back-link" href="/app"><School size={18} /> חזרה לעמוד הכניסה</Link>
        </section>
      </div>
    </main>
  );
}
