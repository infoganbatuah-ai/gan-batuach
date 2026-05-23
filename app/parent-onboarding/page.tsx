import { Camera, FileHeart, HeartPulse, IdCard, ShieldCheck, UserRoundCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ParentChildRegistrationWizard } from "@/components/provisioning-forms";
import { requireRole } from "@/lib/auth";

const steps = [
  { icon: IdCard, title: "פרטי הורה", text: "לפחות תעודת זהות אחת של הורה נדרשת לזיהוי ואחריות." },
  { icon: FileHeart, title: "פרטי ילד", text: "שם, תאריך לידה, קופה, כתובת ופרטים בסיסיים." },
  { icon: HeartPulse, title: "בריאות", text: "אלרגיות, רגישויות, תרופות קבועות והצהרת בריאות." },
  { icon: UserRoundCheck, title: "מורשי איסוף", text: "רק אנשים מורשים יכולים להופיע בתהליך איסוף." },
  { icon: Camera, title: "הסכמות", text: "צילום, מערכת, פרטיות וצפייה במצלמות אם רלוונטי." },
  { icon: ShieldCheck, title: "אישור גננת", text: "הילד פעיל רק לאחר בדיקה ואישור מנהלת הגן." }
];

export default async function ParentOnboardingPage() {
  await requireRole(["parent"]);

  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero slim-hero">
          <p className="eyebrow">רישום ילד</p>
          <h1>אשף רישום רגוע וברור להורים.</h1>
          <p>לאחר השליחה מנהלת הגן מקבלת בקשה מסודרת לאישור. הילד יופיע כתלמיד פעיל רק לאחר אישור.</p>
        </section>
        <section className="section wizard-layout">
          <aside className="wizard-steps progress-rail">
            {steps.map((step, index) => (
              <div className="wizard-step" key={step.title}>
                <span>{index + 1}</span>
                <step.icon size={20} />
                <div><strong>{step.title}</strong><small>{step.text}</small></div>
              </div>
            ))}
          </aside>
          <ParentChildRegistrationWizard />
        </section>
      </main>
    </>
  );
}
