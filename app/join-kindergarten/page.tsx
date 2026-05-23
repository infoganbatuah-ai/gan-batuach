import { Building2, Camera, ClipboardList, FileCheck2, Send, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { createGardenLead } from "@/app/actions";

const steps = [
  { icon: Building2, title: "פרטי הגן", text: "שם, עיר, כתובת וסוג מסגרת." },
  { icon: UsersRound, title: "בעלים ומנהל", text: "מי אחראי לקבלת משתמש מנהל." },
  { icon: ClipboardList, title: "ילדים וצוות", text: "קיבולת, גילאים ומספר אנשי צוות." },
  { icon: Camera, title: "מצלמות", text: "האם קיימות מצלמות ומה נדרש לחיבור מאובטח." },
  { icon: FileCheck2, title: "מסמכים", text: "רישוי, ביטוח, בטיחות, תברואה, פרטיות ואישורי מצלמות." },
  { icon: Send, title: "שליחה לאדמין", text: "האדמין מאשר, מבקש השלמה או יוצר משתמש מנהל." }
];

export default async function JoinKindergartenPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const params = await searchParams;

  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero slim-hero">
          <p className="eyebrow">הצטרפות גן</p>
          <h1>תהליך הצטרפות ברור שמכין את הגן לניהול, שקיפות ופיקוח.</h1>
          <p>הטופס בנוי כאשף כדי לאסוף את הנתונים שהאדמין צריך לפני פתיחת משתמש גננת / מנהלת גן.</p>
          {params.lead === "sent" ? <div className="success-banner">בקשת ההצטרפות נשלחה לאדמין.</div> : null}
        </section>

        <section className="section wizard-layout">
          <aside className="wizard-steps">
            {steps.map((step, index) => (
              <div className="wizard-step" key={step.title}>
                <span>{index + 1}</span>
                <step.icon size={20} />
                <div><strong>{step.title}</strong><small>{step.text}</small></div>
              </div>
            ))}
          </aside>

          <form action={createGardenLead} className="card form wizard-form">
            <h2>בקשת הצטרפות גן לגן בטוח</h2>
            <p>המידע יוצג לאדמין בלבד לצורך בדיקה, יצירת קשר והחלטה האם לפתוח סביבת גן פעילה.</p>
            <div className="form-section"><h3>1. פרטי הגן</h3><div className="form-grid"><label>שם הגן<input name="garden_name" required /></label><label>עיר<input name="city" required /></label><label>כתובת<input name="address" /></label><label>גילאים<input name="age_groups" placeholder="לידה-3, 3-6, מעורב" /></label><label>מספר ילדים<input name="children_count" type="number" min="0" /></label><label>מספר אנשי צוות<input name="staff_count" type="number" min="0" /></label></div></div>
            <div className="form-section"><h3>2. בעלים / מנהל</h3><div className="form-grid"><label>שם בעלים / מנהל<input name="owner_name" required /></label><label>טלפון<input name="phone" required /></label><label>מייל<input name="email" type="email" /></label></div></div>
            <div className="form-section"><h3>3. מצלמות ומסמכים</h3><div className="form-grid"><label>סטטוס מצלמות<select name="camera_status"><option>אין מצלמות</option><option>יש DVR/NVR</option><option>יש מצלמות IP</option><option>צריך בדיקת חיבור</option></select></label><label>סטטוס מסמכים<select name="documents_status"><option>לא הועלו עדיין</option><option>קיימים חלקית</option><option>קיימים ומוכנים לבדיקה</option></select></label><label className="wide">הערות<textarea name="notes" rows={4} placeholder="ספרו על הגן, הצרכים, מועדי פעילות וכל פרט חשוב" /></label></div></div>
            <div className="declaration-box"><strong>הצהרה</strong><span>המערכת אינה גוף ממשלתי ואינה מחליפה ייעוץ משפטי. היא מספקת תשתית ניהול, שקיפות ובקרה מקצועית לגנים פרטיים.</span></div>
            <button className="button primary large" type="submit">שליחת בקשה לאדמין</button>
          </form>
        </section>
      </main>
    </>
  );
}
