import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/brand-header";
import { signIn } from "@/app/login/actions";
import { dashboardPathForRole, getSessionProfile } from "@/lib/auth";
import { isRole } from "@/lib/roles";
import { PasskeyLogin } from "@/components/passkey-login";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const { profile } = await getSessionProfile();
  if (profile?.role && isRole(profile.role)) redirect(dashboardPathForRole(profile.role));
  return (
    <>
      <BrandHeader />
      <main className="section">
        <div className="grid cols-2">
          <section>
            <p className="eyebrow">כניסה מרכזית</p><h1>כניסה לכלל המשתמשים</h1>
            <p>כניסה לכלל המשתמשים - הורים, גננת, מנהלת גן, בעלי גן, צוות גן, פקחים ואדמין. לאחר ההתחברות המערכת מזהה את התפקיד ומעבירה לדשבורד המתאים.</p>
            <div className="notice">המערכת שומרת session מאובטח. אם כבר התחברת, תועבר אוטומטית לדשבורד שלך.</div>
          </section>
          <div className="login-stack">
            <form className="card form" action={signIn}>
              <h2>פרטי כניסה</h2>{params?.error ? <p className="pill bad">{params.error}</p> : null}
              <label>אימייל<input name="email" type="email" required placeholder="name@example.com" autoComplete="username" /></label>
              <label>סיסמה<input name="password" type="password" required autoComplete="current-password" /></label>
              <button className="button primary" type="submit">כניסה</button>
            </form>
            <PasskeyLogin />
          </div>
        </div>
      </main>
    </>
  );
}
