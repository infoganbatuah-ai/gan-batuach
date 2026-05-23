import { BrandHeader } from "@/components/brand-header";
import { signIn } from "@/app/login/actions";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params?.error;
  return (
    <>
      <BrandHeader />
      <main className="section">
        <div className="grid cols-2">
          <section>
            <p className="eyebrow">Authentication</p>
            <h1>כניסה למערכת</h1>
            <p>
              ההתחברות משתמשת ב-Supabase Auth. תפקיד המשתמש נשמר ב-`profiles.role`,
              והמערכת מנתבת לדשבורד המתאים לפי RBAC.
            </p>
            <div className="notice">
              צור משתמשים ב-Supabase Auth, ואז עדכן את `profiles.role` לאחד: admin,
              inspector, manager, staff, parent.
            </div>
          </section>
          <form className="card form" action={signIn}>
            <h2>פרטי כניסה</h2>
            {error ? <p className="pill bad">{error}</p> : null}
            <label>
              אימייל
              <input name="email" type="email" required placeholder="admin@example.co.il" />
            </label>
            <label>
              סיסמה
              <input name="password" type="password" required />
            </label>
            <button className="button primary" type="submit">
              כניסה
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
