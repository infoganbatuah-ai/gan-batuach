import { ClipboardCheck, FileBadge, MapPin, Send, UserCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ContactAvailabilityGuard } from "@/components/contact-availability-guard";
import { createInspectorLead } from "@/app/actions";

const steps = [
  { icon: UserCheck, title: "פרטים אישיים", text: "שם, טלפון ואימייל לחזרה." },
  { icon: MapPin, title: "אזור עבודה", text: "עיר או אזור שבו תרצו לפקח." },
  { icon: ClipboardCheck, title: "ניסיון", text: "חינוך, בטיחות, ניהול, תברואה או פיקוח." },
  { icon: FileBadge, title: "הסמכות", text: "קורסים, תעודות והכשרות רלוונטיות." },
  { icon: Send, title: "שליחה", text: "האדמין בודק וממיר לפקח פעיל אם מתאים." }
];

export default async function JoinInspectorPage({ searchParams }: { searchParams: Promise<{ lead?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero slim-hero">
          <p className="eyebrow">בואו להיות מפקחים</p>
          <h1>הצטרפות למערך המפקחים של גן בטוח.</h1>
          <p>אנו מכשירים מפקחים לעבודה לפי סטנדרט הפיקוח הפרטי והטכנולוגי של גן בטוח, כולל טפסי ביקורת, בדיקות בטיחות, תיעוד, דוחות ומשימות תיקון.</p>
          {params.lead === "sent" ? <div className="success-banner">הבקשה נשלחה לאדמין. נחזור אליך לאחר בדיקה.</div> : null}
          {params.error ? <div className="error-banner">{params.error}</div> : null}
        </section>
        <section className="section wizard-layout">
          <aside className="wizard-steps">{steps.map((step, index) => <div className="wizard-step" key={step.title}><span>{index + 1}</span><step.icon size={20} /><div><strong>{step.title}</strong><small>{step.text}</small></div></div>)}</aside>
          <form action={createInspectorLead} className="card form wizard-form">
            <div className="progress-bar"><span style={{ width: "70%" }} /></div>
            <h2>בקשת הצטרפות כמפקח/ת</h2>
            <p>הפרטים נשמרים כליד אדמין. אם הבקשה תאושר, האדמין ייצור משתמש פקח ופרטי כניסה זמניים.</p>
            <div className="form-grid">
              <label>שם מלא *<input name="full_name" required /></label>
              <label>טלפון *<input name="phone" required /></label>
              <label>אימייל<input name="email" type="email" /></label>
              <label>עיר / אזור פעילות *<input name="city_area" required placeholder="לדוגמה: תל אביב והמרכז" /></label>
              <label className="wide">ניסיון רלוונטי<textarea name="experience" rows={4} placeholder="חינוך, ניהול גן, בטיחות, תברואה, פיקוח, הדרכה" /></label>
              <label className="wide">הסמכות / תעודות<textarea name="certifications" rows={3} placeholder="עזרה ראשונה, בטיחות, הדרכה, תארים או קורסים" /></label>
              <label className="wide">הערות<textarea name="notes" rows={3} /></label>
            </div>
            <ContactAvailabilityGuard />
            <button className="button primary large" type="submit">שליחת בקשה לאדמין</button>
          </form>
        </section>
      </main>
    </>
  );
}
