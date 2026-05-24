import { Building2, Camera, ClipboardList, FileCheck2, Send, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ContactAvailabilityGuard } from "@/components/contact-availability-guard";
import { createGardenLead } from "@/app/actions";

const steps = [
  { icon: Building2, title: "פרטי הגן", text: "שם, עיר, כתובת וסוג מסגרת." },
  { icon: UsersRound, title: "בעלים ומנהל", text: "פרטי בעלים, מנהלת/גננת ודרכי קשר." },
  { icon: ClipboardList, title: "גילאים וקיבולת", text: "תינוקות, פעוטות, 3-4, 4-5 או קבוצה מעורבת." },
  { icon: Camera, title: "מצלמות ותפעול", text: "DVR/NVR/IP, מטבח, אוכל ומוכנות לחיבור." },
  { icon: FileCheck2, title: "מסמכים", text: "רישוי, ביטוח, בטיחות, תברואה, פרטיות ואישורי מצלמות." },
  { icon: Send, title: "שליחה לאדמין", text: "האדמין מאשר, מבקש השלמה או יוצר משתמש מנהל." }
];

export default async function JoinKindergartenPage({ searchParams }: { searchParams: Promise<{ lead?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero slim-hero">
          <p className="eyebrow">הצטרפות גן</p>
          <h1>תהליך הצטרפות ברור שמכין את הגן לניהול, שקיפות ופיקוח.</h1>
          <p>הטופס שומר בקשת הצטרפות בסופאבייס ומציג אותה לאדמין בלידים ובבקשות הצטרפות.</p>
          {params.lead === "sent" ? <div className="success-banner">בקשת ההצטרפות נשלחה לאדמין.</div> : null}
          {params.error ? <div className="error-banner">{params.error}</div> : null}
        </section>
        <section className="section wizard-layout">
          <aside className="wizard-steps">{steps.map((step, index) => <div className="wizard-step" key={step.title}><span>{index + 1}</span><step.icon size={20} /><div><strong>{step.title}</strong><small>{step.text}</small></div></div>)}</aside>
          <form action={createGardenLead} className="card form wizard-form">
            <div className="progress-bar"><span style={{ width: "82%" }} /></div>
            <h2>בקשת הצטרפות גן לגן בטוח</h2><p>שדות חובה מסומנים. המסמכים עצמם יועלו בהמשך מתוך ממשק הגן לאחר אישור אדמין.</p>
            <div className="form-section"><h3>1. פרטי הגן</h3><div className="form-grid"><label>שם הגן *<input name="garden_name" required /></label><label>עיר *<input name="city" required /></label><label className="wide">כתובת מלאה<input name="address" required /></label></div></div>
            <div className="form-section"><h3>2. בעלים ומנהל/גננת</h3><div className="form-grid"><label>שם בעלים *<input name="owner_name" required /></label><label>שם מנהל/גננת<input name="manager_name" /></label><label>טלפון *<input name="phone" required /></label><label>מייל<input name="email" type="email" /></label></div></div>
            <ContactAvailabilityGuard />
            <div className="form-section"><h3>3. גילאים, קיבולת וצוות</h3><div className="choice-grid detection-grid"><label><input type="checkbox" name="age_groups" value="babies" /> תינוקות</label><label><input type="checkbox" name="age_groups" value="toddlers" /> פעוטות</label><label><input type="checkbox" name="age_groups" value="3-4" /> 3-4</label><label><input type="checkbox" name="age_groups" value="4-5" /> 4-5</label><label><input type="checkbox" name="age_groups" value="mixed" /> קבוצה מעורבת</label></div><div className="form-grid"><label>טווח גיל מותאם<input name="custom_age_range" placeholder="לדוגמה: שנה וחצי עד ארבע" /></label><label>מספר ילדים<input name="children_count" type="number" min="0" /></label><label>קיבולת<input name="capacity" type="number" min="0" /></label><label>מספר אנשי צוות<input name="staff_count" type="number" min="0" /></label></div></div>
            <div className="form-section"><h3>4. מצלמות, מטבח ומסמכים</h3><div className="form-grid"><label>האם קיימות מצלמות?<select name="camera_status"><option value="no">לא</option><option value="dvr_nvr">כן, DVR/NVR</option><option value="ip">כן, מצלמות IP</option><option value="unknown">צריך בדיקת חיבור</option></select></label><label>מטבח / אוכל<select name="food_kitchen"><option>יש מטבח</option><option>ספק אוכל חיצוני</option><option>אין מטבח</option></select></label><label>סטטוס מסמכים<select name="documents_status"><option>לא הועלו עדיין</option><option>קיימים חלקית</option><option>קיימים ומוכנים לבדיקה</option></select></label><label>עוסק פטור / מורשה / חברה<input name="business_document_name" type="file" /></label><label>רישיון גן<input name="license_document_name" type="file" /></label><label>אישור לימודים / הוראה של הגננת<input name="teacher_certificate_name" type="file" /></label><label className="wide">מסמכים נוספים<input name="additional_documents_name" type="file" multiple /></label><label className="wide">הערות למסמכים<input name="additional_documents_note" placeholder="שם מסמך/קישור אם קיים" /></label><label className="wide">הערות<textarea name="notes" rows={4} placeholder="מועדי פעילות, צרכים, מצב פיקוח וכל פרט חשוב" /></label></div></div>
            <label className="declaration-box"><input name="declaration" type="checkbox" required /><span><strong>הצהרה</strong> המערכת אינה גוף ממשלתי ואינה מחליפה ייעוץ משפטי. הפרטים נשלחים לבדיקה והמשך תהליך מול אדמין.</span></label>
            <label className="declaration-box"><input name="kindergarten_terms_commitment" type="checkbox" required /><span><strong>התחייבות לתקנון גני ילדים</strong> קראתי ואני מתחייב/ת להשלים מסמכים, לפעול לפי נהלי גן בטוח ולשמור על פרטיות קטינים.</span></label>
            <button className="button primary large" type="submit">שליחת בקשה לאדמין</button>
          </form>
        </section>
      </main>
    </>
  );
}
