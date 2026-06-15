import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import { ProductRoleCards, SelfServiceRegisterForm } from "@/components/self-service-forms";

export default function RegisterPage() {
  return (
    <>
      <BrandHeader />
      <main className="section login-journey-page">
        <section className="login-hero">
          <div>
            <p className="eyebrow">הרשמה עצמאית</p>
            <h1>מצטרפים לגן בטוח ומגישים בקשת שיוך.</h1>
            <p>הרשמה עצמאית יוצרת חשבון מוגבל בלבד. גישה לגן, ילדים, צוות או פיקוח נפתחת רק אחרי אישור הגורם המתאים.</p>
            <div className="notice">כבר קיבלתם הזמנה מהגן? השתמשו במסך הכניסה הרגיל כדי לשמור על מסלול ההזמנה הקיים.</div>
            <Link className="button secondary" href="/login">כניסה לחשבון קיים</Link>
          </div>
          <ProductRoleCards />
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
