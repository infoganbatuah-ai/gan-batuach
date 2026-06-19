import Link from "next/link";
import { Baby, BriefcaseBusiness, Building2, ClipboardCheck } from "lucide-react";
import { AppAuthShell } from "@/components/app-auth-shell";
import { ActionCard, DashboardGrid } from "@/components/gan-batuach-design-system";
import { SelfServiceRegisterForm, type SelfServiceAccountType } from "@/components/self-service-forms";

const roleCards: Array<{ type: SelfServiceAccountType; href: string; icon: typeof Baby; title: string; text: string; cta: string }> = [
  { type: "parent", href: "/app/register/parent", icon: Baby, title: "הורה", text: "צרו כרטיס ילד, מצאו גנים בטוחים והגישו בקשת רישום.", cta: "הרשמה כהורה" },
  { type: "kindergarten_manager", href: "/app/register/kindergarten", icon: Building2, title: "מנהלת גן / גננת", text: "רשמו את הגן, הגדירו קבוצות גיל, מחירים וניהול מלא.", cta: "רישום גן" },
  { type: "staff_candidate", href: "/app/register/staff", icon: BriefcaseBusiness, title: "צוות גן", text: "השלימו פרטים והתחברו לגן שבו אתם עובדים או מגישים מועמדות.", cta: "הרשמה כאיש צוות" },
  { type: "inspector_candidate", href: "/app/register/inspector", icon: ClipboardCheck, title: "מפקח", text: "הגישו בקשה להצטרפות למערך הפיקוח ושיוך לגנים.", cta: "הרשמה כמפקח" }
];

export function AppRegisterEntryScreen() {
  return (
    <AppAuthShell
      eyebrow="משתמש חדש"
      title="מה סוג המשתמש שלך?"
      subtitle="בחרו מסלול אחד. כל חשבון חדש נפתח במצב מוגבל עד אישור מתאים."
      footer={<span>כבר יש לך חשבון? <Link href="/app/login">התחברות</Link></span>}
    >
      <DashboardGrid columns={2} className="app-role-choice-grid gb-auth-role-grid">
        {roleCards.map((role) => (
          <ActionCard title={role.title} text={<><span>{role.text}</span><em>{role.cta}</em></>} icon={role.icon} href={role.href} key={role.type} tone={role.type === "staff_candidate" ? "info" : "primary"} />
        ))}
      </DashboardGrid>
    </AppAuthShell>
  );
}

export function AppRoleRegisterScreen({ role }: { role: SelfServiceAccountType }) {
  const active = roleCards.find((item) => item.type === role) ?? roleCards[0];
  return (
    <AppAuthShell
      eyebrow="הרשמה ממוקדת"
      title={active.cta}
      subtitle="מלאו רק את הפרטים הדרושים למסלול הזה. גישה רגישה תיפתח רק אחרי אישור ושיוך מתאים."
      footer={<span>בחרתם מסלול לא נכון? <Link href="/app/register">חזרה לבחירת תפקיד</Link></span>}
    >
      <SelfServiceRegisterForm fixedAccountType={role} appMode />
    </AppAuthShell>
  );
}
