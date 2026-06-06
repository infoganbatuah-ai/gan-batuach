import { redirect } from "next/navigation";
import { Baby, Building2, ClipboardCheck, HeartHandshake, ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { signIn } from "@/app/login/actions";
import { dashboardPathForProfile, getSessionProfile } from "@/lib/auth";
import { isRole } from "@/lib/roles";
import { PasskeyLogin } from "@/components/passkey-login";

const audiences = [
  { icon: Baby, title: "הורים", text: "היום של הילד, הודעות, מסמכים, תשלומים ומצלמות אם אושרו." },
  { icon: UsersRound, title: "צוות", text: "משימות היום, יומן ילדים, נוכחות, מסמכים והודעות מנהלת." },
  { icon: Building2, title: "גננת / מנהלת גן", text: "ניהול יומי של ילדים, צוות, הורים, תשלומים ופיקוח." },
  { icon: HeartHandshake, title: "בעלים", text: "בריאות הגן, כספים, צוות, סיכונים ודוחות." },
  { icon: ClipboardCheck, title: "מפקח", text: "גנים משויכים, ביקורות, מצלמות לפי הרשאה ודוחות." }
];

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string; gardenId?: string; audience?: string }> }) {
  const params = await searchParams;
  const { profile } = await getSessionProfile();
  if (profile?.role && isRole(profile.role)) redirect(await dashboardPathForProfile(profile));
  return (
    <>
      <BrandHeader />
      <main className="section login-journey-page">
        <section className="login-hero">
          <div>
            <p className="eyebrow">כניסה אחת לכל משתמשי גן בטוח</p>
            <h1>מתחברים פעם אחת, והמערכת מעבירה אותך למקום הנכון.</h1>
            <p>הורים, צוות, גננת/מנהלת, בעלים ומפקחים משתמשים באותו מסך כניסה. אחרי ההתחברות גן בטוח מזהה את התפקיד ומציג את הדשבורד המתאים.</p>
            {params?.gardenId ? <div className="notice"><ShieldCheck size={16} /> ההתחברות נשמרת בהקשר של הגן שממנו הגעת.</div> : null}
          </div>
          <div className="login-audience-grid">
            {audiences.map((item) => <article className="audience-card" key={item.title}><item.icon /><strong>{item.title}</strong><span>{item.text}</span><a href="#login-form" className="button secondary tiny">התחברות</a></article>)}
          </div>
        </section>
        <div className="grid cols-2 login-content-grid">
          <section className="card action-panel">
            <p className="eyebrow">Role detection</p>
            <h2>אין מערכות כניסה נפרדות</h2>
            <p>אין צורך לבחור “הורה” או “צוות” אחרי הכניסה. המערכת עושה זאת לבד לפי המשתמש שנוצר בגן.</p>
            <div className="journey-steps compact"><span><b>1</b><UserRoundCheck size={16} /> הזנת פרטים</span><span><b>2</b><ShieldCheck size={16} /> אימות מאובטח</span><span><b>3</b><Building2 size={16} /> מעבר לדשבורד</span></div>
          </section>
          <div className="login-stack">
            <form className="card form premium-login-card" action={signIn} id="login-form">
              <h2>פרטי כניסה</h2>{params?.error ? <p className="pill bad">{params.error}</p> : null}
              <input type="hidden" name="context_garden_id" value={params?.gardenId ?? ""} />
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
