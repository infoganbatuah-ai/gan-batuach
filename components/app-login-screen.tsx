import { redirect } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { signIn } from "@/app/login/actions";
import { LoginSubmitButton } from "@/components/auth-submit-button";
import { AppAuthShell } from "@/components/app-auth-shell";
import { dashboardPathForProfile, getSessionProfile } from "@/lib/auth";
import { isRole } from "@/lib/roles";

type LoginSearchParams = { error?: string; next?: string; gardenId?: string; audience?: string };

export async function AppLoginScreen({ searchParams }: { searchParams?: Promise<LoginSearchParams> }) {
  const params = await searchParams;
  const { profile } = await getSessionProfile();
  if (profile?.role && isRole(profile.role)) redirect(await dashboardPathForProfile(profile));

  return (
    <AppAuthShell
      eyebrow="משתמש קיים"
      title="כניסה למערכת גן בטוח"
      subtitle="התחברו כדי לנהל את הגן, לעקוב אחרי ילדכם או לבצע פיקוח."
      footer={<span>עדיין אין לך חשבון? <Link href="/app/register">הרשמה עכשיו</Link></span>}
    >
      <form className="app-auth-form" action={signIn}>
        {params?.error ? <p className="error-banner">{params.error}</p> : null}
        <input type="hidden" name="context_garden_id" value={params?.gardenId ?? ""} />
        <input type="hidden" name="auth_source" value="app" />
        <label>אימייל<input name="email" type="email" required placeholder="name@example.com" autoComplete="username" /></label>
        <label>סיסמה<input name="password" type="password" required autoComplete="current-password" /></label>
        <div className="login-form-links"><Link href="/forgot-password">שכחת סיסמה?</Link></div>
        <LoginSubmitButton />
        <Link className="button secondary large" href="/app/register"><LogIn size={18} /> הרשמה כמשתמש חדש</Link>
      </form>
    </AppAuthShell>
  );
}
