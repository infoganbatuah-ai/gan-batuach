import { FileCheck2, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { createClient } from "@/lib/supabase/server";

const fallbackContent = `
אמנת השירות של גן בטוח מגדירה את האחריות המשותפת של מנהלת הגן, צוות הגן ופלטפורמת גן בטוח.

מנהלת הגן אחראית לשמירה על בטיחות הילדים, השלמת מסמכים, הזמנת צוות והורים, עדכון פרטי ילדים, עמידה בדרישות פיקוח ושיתוף פעולה עם תהליכי בדיקה.

גן בטוח מספקת מערכת לניהול, שקיפות, מסמכים, תיעוד, פיקוח, תשלומים, מצלמות בהרשאה ותובנות חכמות. המערכת אינה מחליפה אחריות ניהולית, ייעוץ משפטי או דרישות רגולטוריות.

מצלמות במערכת מיועדות לשקיפות ובקרה בלבד, ללא שמע, בהתאם להרשאות, שעות צפייה וכללי פרטיות. אירועי תצפיתן חכם מחייבים בדיקה אנושית לפני כל שימוש.

הגן מתחייב לשקיפות מול הורים, שמירה על פרטיות קטינים, טיפול במסמכים חסרים, השלמת הכשרות צוות ושיתוף פעולה עם בדיקות פיקוח ופעולות תיקון.
`;

export const metadata = {
  title: "אמנת השירות של גן בטוח",
  description: "אמנת השירות, האחריות והבטיחות של גן בטוח."
};

export default async function ServiceCharterPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_charters" as any)
    .select("title, version, content")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const content = String(data?.content ?? fallbackContent).trim();

  return (
    <>
      <BrandHeader />
      <main className="section">
        <section className="page-hero slim-hero registration-hero">
          <p className="eyebrow">אמנת שירות</p>
          <h1>{data?.title ?? "אמנת השירות של גן בטוח"}</h1>
          <p>גרסה {data?.version ?? "2026-06-13"} · מסמך אחריות, שקיפות, פרטיות ובטיחות לגנים המצטרפים.</p>
        </section>
        <section className="card action-panel">
          <h2><ShieldCheck size={22} /> עיקרי האמנה</h2>
          <div className="policy-document-text">
            {content.split("\n").filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>
        <section className="quick-actions-grid">
          <article className="premium-action-card"><FileCheck2 size={22} /><strong>אחריות מנהלת</strong><span>השלמת מידע, מסמכים, צוות, הורים ותשלום לפני הפעלה.</span></article>
          <article className="premium-action-card"><ShieldCheck size={22} /><strong>פרטיות ילדים</strong><span>מידע רגיש נגיש רק לפי הרשאות ותפקידים.</span></article>
        </section>
      </main>
    </>
  );
}
