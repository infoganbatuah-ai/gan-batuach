import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  ShieldCheck,
} from "lucide-react";
import { AppAuthShell } from "@/components/app-auth-shell";
import { AuthPasswordInput } from "@/components/auth-password-input";
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
    <AppAuthShell
      eyebrow="שמחים שחזרת"
      title="התחברות למערכת"
      subtitle="הזינו את הפרטים שלכם ונעביר אתכם לסביבת העבודה המתאימה."
      footer={<span>אין לכם חשבון? <Link href="/app/register">יצירת חשבון</Link></span>}
    >
        <section className="gb-reference-login-card" aria-label="טופס התחברות">
          <form className="gb-reference-login-form" action={signIn}>
            {params?.error ? <p className="error-banner">{params.error}</p> : null}
            <input type="hidden" name="context_garden_id" value={params?.gardenId ?? ""} />
            <input type="hidden" name="auth_source" value="app" />
            <input type="hidden" name="next" value={params?.next ?? ""} />

            <label className="gb-reference-field">
              <span className="sr-only">כתובת אימייל</span>
              <input name="email" type="email" required placeholder="כתובת אימייל" autoComplete="username" dir="ltr" />
              <span className="gb-reference-field-icon"><Mail size={28} /></span>
            </label>

            <AuthPasswordInput />

            <div className="gb-reference-login-options">
              <label>
                <input type="checkbox" name="remember" value="1" />
                <span>זכור אותי</span>
              </label>
              <Link href="/forgot-password">שכחתי סיסמה</Link>
            </div>

            <LoginSubmitButton />
          </form>
          <aside className="gb-reference-security-card" aria-label="כניסה אחת לכל סוגי המשתמשים">
            <div className="gb-reference-security-shield"><ShieldCheck size={42} /></div>
            <div>
              <h2>כניסה אחת לכל סוגי המשתמשים</h2>
              <p>הורים, גנים, צוות ומפקחים — ההרשאות נקבעות לפי החשבון והשיוך הפעיל.</p>
            </div>
          </aside>
        </section>
    </AppAuthShell>
  );
}
