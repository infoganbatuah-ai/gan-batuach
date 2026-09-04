import { notFound, redirect } from "next/navigation";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { guardQaEnvironmentAllowed, guardQaUserAllowed } from "@/lib/domain/digital-observer/qa-learning-fixture";
import { GuardLearningQaPanel } from "@/components/digital-observer/guard-learning-qa-panel";

export const dynamic = "force-dynamic";

export default async function GuardLearningQaPage() {
  if (!guardQaEnvironmentAllowed(process.env)) notFound();
  const session = await getDigitalObserverApiUser();
  if (!session) redirect("/digital-observer/login?next=/digital-observer/qa/learning");
  if (!guardQaUserAllowed(session)) notFound();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if (!/^[a-f0-9]{40}$/.test(commit)) notFound();
  return <main dir="rtl" className="do-page-stack" style={{ maxWidth: 760, margin: "40px auto", padding: 24 }}>
    <h1>בדיקת למידה מבודדת — סביבת בדיקות בלבד</h1>
    <p>המסך זמין רק לחשבון הבדיקות המאושר, לאחר כניסה רגילה ל־Vercel ולאפליקציה.</p>
    <p>ייווצר אתר בדיקה זמני עם שתי מצלמות דמה. ייבדקו למידה, מניעת כפילויות, רישום אירוע והרשאות. בסיום יימחקו רק הנתונים של ההרצה הזו.</p>
    <p>אין הפעלת חומרה, זיהוי פנים, צילום או חיוג חירום.</p>
    <p>גרסה: <code dir="ltr">{commit.slice(0, 12)}</code></p>
    <GuardLearningQaPanel commit={commit} />
  </main>;
}
