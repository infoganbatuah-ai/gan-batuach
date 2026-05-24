import Link from "next/link";
import { Accessibility, Bot, Camera, FileText, LockKeyhole, ShieldCheck, ScrollText, ServerCog } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";

const items = [
  { icon: ShieldCheck, title: "אבטחה ופרטיות", text: "הפרדת גנים, הרשאות לפי תפקיד, RLS, Audit Logs וניהול סשנים כדי לצמצם חשיפה למידע רגיש של קטינים." },
  { icon: LockKeyhole, title: "גישה למידע", text: "הורה רואה רק את ילדו ואת המידע המאושר עבור הגן שלו. פקח רואה רק גנים שהוקצו לו. אדמין מנהל גישה מלאה לפי הרשאה." },
  { icon: Camera, title: "מדיניות מצלמות", text: "המערכת תומכת ברישום DVR/NVR/IP/RTSP/ONVIF דרך Video Gateway. אין חשיפת כתובות RTSP להורים, וצפייה מתבצעת עם Token זמני ולוג צפייה." },
  { icon: Bot, title: "תצפיתן AI", text: "תצפיתן דיגיטלי מיועד לסייע בזיהוי חריגים כמו נפילה, ילד לבד, אזור אסור, בכי חריג, צפיפות או מצלמה מכוסה. הפעלה חיה דורשת AI Gateway מחובר." },
  { icon: ServerCog, title: "Audit Logs", text: "פעולות רגישות נשמרות עם משתמש, תפקיד, זמן, גן וישות קשורה כדי להפריד בין מנהלת, בעלים, צוות, פקח ואדמין." },
  { icon: FileText, title: "תקנונים ומסמכים", text: "תקנוני גנים, הורים, צוות ומפקחים ניתנים לעריכה ופרסום, ומשתמשים נדרשים לאשר גרסה עדכנית לפני שימוש." },
  { icon: Accessibility, title: "נגישות", text: "הממשק נבנה RTL, רספונסיבי, עם היררכיית טקסט ברורה, כפתורים גדולים ומצבי שגיאה ידידותיים בעברית." },
  { icon: ScrollText, title: "הבהרה משפטית", text: "גן בטוח אינה גוף ממשלתי ואינה מחליפה ייעוץ משפטי, רישוי רשמי או חובות רגולטוריות. היא מספקת סטנדרט פיקוח פרטי וטכנולוגי." }
];

export default function TrustPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <section className="hero trust-hero">
          <div className="hero-content stack-xl">
            <div className="hero-badge"><ShieldCheck size={18} /> Trust Center</div>
            <h1>מערכת טכנולוגית מוגנת בפטנט לניהול, פיקוח ושקיפות בגני ילדים פרטיים.</h1>
            <p>מרכז אמון זה מסביר איך גן בטוח מתייחסת לפרטיות קטינים, הרשאות, מצלמות, AI, מסמכים, תקנונים ולוגים. המערכת אינה רגולטור ממשלתי ואינה מצהירה שהיא מחליפה רישוי רשמי.</p>
            <div className="actions"><Link className="button primary large" href="/gardens">חיפוש גנים</Link><Link className="button secondary large" href="/login">כניסה למערכת</Link></div>
          </div>
        </section>
        <section className="section compact-section">
          <div className="grid cols-4 feature-grid">{items.map((item) => <article className="card feature-card trust-card" key={item.title}><item.icon className="feature-icon" /><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
        </section>
        <section className="section cta-section">
          <div><p className="eyebrow">מדיניות ותקנונים</p><h2>כל גן ומשתמש מאשרים את התקנון הרלוונטי להם מתוך המערכת.</h2></div>
          <div className="actions"><Link className="button secondary large" href="/dashboard/admin/policies">ניהול תקנונים</Link><Link className="button large" href="/join-kindergarten">הצטרפות גן</Link></div>
        </section>
      </main>
    </>
  );
}
