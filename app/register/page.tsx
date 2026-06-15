import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { SelfServiceRegisterForm } from "@/components/self-service-forms";

export default function RegisterPage() {
  return (
    <>
      <BrandHeader />
      <main className="section login-journey-page">
        <section className="login-hero">
          <div>
            <p className="eyebrow">הרשמה עצמאית</p>
            <h1>משתמש חדש?</h1>
            <p>הרשמה עצמאית יוצרת חשבון מוגבל בלבד. גישה לגן, ילדים, צוות או פיקוח נפתחת רק אחרי אישור הגורם המתאים.</p>
            <div className="notice">כבר קיבלתם הזמנה מהגן? השתמשו במסך הכניסה הרגיל כדי לשמור על מסלול ההזמנה הקיים.</div>
            <div className="profile-actions">
              <Link className="button secondary" href="/app">חזרה לכניסה למערכת</Link>
              <Link className="button secondary" href="/login">התחברות למערכת</Link>
            </div>
          </div>
          <section className="card action-panel auth-readiness-card">
            <p className="eyebrow">חשבון מוגבל קודם</p>
            <h2>אישור לפני גישה רגישה</h2>
            <p>הורה, צוות, מפקח או מנהלת גן לא מקבלים גישה לנתוני גן עד אישור ושיוך מתאים.</p>
          </section>
        </section>
        <div className="grid cols-2 login-content-grid">
          <section className="card action-panel">
            <p className="eyebrow">גישה בטוחה</p>
            <h2>חשבון חדש לא מקבל גישה לגן באופן אוטומטי.</h2>
            <p>הורה ממתין לאישור מנהלת ותשלום אם נדרש. מועמד צוות ממתין לאישור מנהלת. מועמד מפקח ממתין לאישור אדמין ושיוך גנים.</p>
          </section>
          <SelfServiceRegisterForm />
        </div>
      </main>
    </>
  );
}
