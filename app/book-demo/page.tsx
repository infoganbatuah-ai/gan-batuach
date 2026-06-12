import { CalendarCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { createDemoBooking } from "@/app/actions";

export const metadata = {
  title: "קביעת הדגמה | גן בטוח",
  description: "קבעו הדגמה לגן בטוח וקבלו תוכנית מעבר לפיילוט, שקיפות ופיקוח."
};

export default async function BookDemoPage({ searchParams }: { searchParams: Promise<{ lead?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero registration-hero">
          <p className="eyebrow">Book a demo</p>
          <h1>קבעו הדגמה קצרה לגן בטוח</h1>
          <p>נבין את הגן, נזהה מה דורש שיפור, ונראה איך עוברים לפיילוט מסודר בלי עומס על הצוות.</p>
          {params.lead === "sent" ? <div className="success-banner"><CheckCircle2 /> הבקשה התקבלה. נחזור אליכם לתיאום הדגמה.</div> : null}
          {params.error ? <div className="error-banner">{params.error}</div> : null}
        </section>
        <section className="section wizard-layout">
          <aside className="wizard-steps">
            {["שיחת התאמה", "הצגת מערכת", "תוכנית פיילוט", "תחילת ניסיון"].map((step, index) => (
              <div className="wizard-step" key={step}><span>{index + 1}</span><CalendarCheck size={20} /><div><strong>{step}</strong><small>שלב קצר וברור</small></div></div>
            ))}
          </aside>
          <form action={createDemoBooking} className="card form wizard-form premium-step-form">
            <h2>פרטי הדגמה</h2>
            <p>אין צורך בהתחייבות. המטרה היא להבין אם גן בטוח מתאים לגן שלכם.</p>
            <div className="form-grid">
              <label>שם הגן *<input name="garden_name" required /></label>
              <label>עיר<input name="city" /></label>
              <label>שם איש קשר *<input name="contact_name" required /></label>
              <label>תפקיד<select name="role"><option>מנהלת / גננת</option><option>בעלים</option><option>רשת גנים</option><option>יועץ / אחר</option></select></label>
              <label>טלפון *<input name="contact_phone" required /></label>
              <label>מייל<input name="contact_email" type="email" /></label>
              <label>מספר ילדים<input name="children_count" type="number" min="0" /></label>
              <label>מספר אנשי צוות<input name="staff_count" type="number" min="0" /></label>
              <label>תאריך מועדף להדגמה<input name="preferred_demo_date" type="date" /></label>
              <label>שעה או חלון נוח<input name="preferred_time" placeholder="לדוגמה: מחר בבוקר" /></label>
              <label>מצלמות קיימות?<select name="camera_status"><option value="unknown">לא יודע/ת</option><option value="none">אין</option><option value="dvr_nvr">יש DVR/NVR</option><option value="ip">יש מצלמות IP</option></select></label>
              <label>מתי תרצו להתחיל?<select name="decision_timeline"><option value="now">מיידי</option><option value="month">בחודש הקרוב</option><option value="quarter">ברבעון הקרוב</option><option value="later">בהמשך</option></select></label>
              <label className="wide">מה האתגר המרכזי?<textarea name="biggest_challenge" rows={3} placeholder="שקיפות הורים, פיקוח, מסמכים, צוות, מצלמות, תפעול..." /></label>
              <label className="wide">כלים קיימים<input name="current_tools" placeholder="Excel, WhatsApp, מערכת אחרת, ניירת..." /></label>
            </div>
            <div className="choice-grid detection-grid">
              {["שקיפות הורים", "פיקוח", "מצלמות", "מסמכים", "ניהול צוות", "תשלומים"].map((item) => <label key={item}><input type="checkbox" name="interest" value={item} /> {item}</label>)}
            </div>
            <label className="declaration-box"><input required type="checkbox" /> <span><strong>אישור</strong> מותר לצוות גן בטוח ליצור איתי קשר לגבי ההדגמה.</span></label>
            <button className="button primary large" type="submit"><ShieldCheck size={18} /> שליחת בקשה להדגמה</button>
          </form>
        </section>
      </main>
    </>
  );
}
