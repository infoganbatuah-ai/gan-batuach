"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Compass, Sparkles, X } from "lucide-react";
import type { UserRole } from "@/lib/roles";

const welcomeByRole: Record<UserRole, { eyebrow: string; title: string; intro: string; done: string }> = {
  admin: {
    eyebrow: "התחלה מהירה",
    title: "סקירת מערכת בלי עומס",
    intro: "נתחיל מהדברים ששומרים על המערכת יציבה: בריאות, משתמשים, גנים ודוחות.",
    done: "מרכז השליטה מוכן לעבודה שוטפת."
  },
  network_manager: {
    eyebrow: "ניהול רשת",
    title: "נבנה תמונת שליטה לרשת הגנים",
    intro: "נבדוק גנים משויכים, אזורים, פיקוח, ציות, כספים ומדדי תפעול בלי לפתוח מידע שאינו בהרשאה.",
    done: "מרכז הרשת מוכן לעבודה."
  },
  manager: {
    eyebrow: "ברוכה הבאה לגן",
    title: "בואי נכין את הגן לעבודה",
    intro: "כמה צעדים קצרים יעזרו לך לפתוח יום עבודה מסודר: פרופיל, צוות, ילדים, הורים, מצלמות ותצפיתן.",
    done: "הגן מוכן להתחיל לעבוד בצורה מסודרת."
  },
  owner: {
    eyebrow: "ברוכה הבאה",
    title: "תמונת שליטה פשוטה לבעלים",
    intro: "נבדוק שהגן, הצוות, הכספים, המצלמות והמסמכים מוכנים לניהול שוטף.",
    done: "הבסיס התפעולי מוכן."
  },
  parent: {
    eyebrow: "שלום וברוכים הבאים",
    title: "נכין את חשבון ההורה",
    intro: "נבדוק שהילד מחובר לגן, שהפרטים החשובים הושלמו, ושקל למצוא הודעות, מסמכים ומצלמות.",
    done: "החשבון מוכן לשימוש יומי רגוע."
  },
  staff: {
    eyebrow: "ברוכה הבאה לצוות",
    title: "נתחיל במשמרת בצורה פשוטה",
    intro: "השלמת פרופיל, נוכחות, ילדים לעדכון, משימות ודיווח אירוע במקום אחד.",
    done: "מסך העבודה שלך מוכן למשמרת."
  },
  inspector: {
    eyebrow: "ברוך הבא לפיקוח",
    title: "נתחיל מתהליך ביקורת ברור",
    intro: "נראה גנים משויכים, ביקורות שממתינות, ליקויים ודוחות בלי ניווט מיותר.",
    done: "מרחב הפיקוח מוכן לעבודה."
  }
};

const stepsByRole: Record<UserRole, Array<{ title: string; body: string; href: string }>> = {
  admin: [
    { title: "בדיקת בריאות מערכת", body: "וודאו שאין פיקוחים באיחור, מסמכים חסרים או מצלמות שדורשות טיפול.", href: "/dashboard/admin/system-health" },
    { title: "גנים ומשתמשים", body: "פתחו או בדקו גנים, מנהלות, הורים, צוות ומפקחים.", href: "/dashboard/admin/users" },
    { title: "מפקחים ושיוכים", body: "וודאו שכל מפקח רואה רק את הגנים שהוקצו לו.", href: "/dashboard/admin/inspectors" },
    { title: "דוחות ופיקוח", body: "בדקו טפסים, ביקורות פתוחות ודוחות אחרונים.", href: "/dashboard/admin/inspections" },
    { title: "תצפיתן ומצלמות", body: "עברו על מצלמות, חיבורי שידור ואירועים לבדיקה.", href: "/dashboard/admin/ai-observer" },
    { title: "התראות ותקשורת", body: "בדקו הודעות, התראות וערוצי קשר חשובים.", href: "/dashboard/admin/notifications" }
  ],
  network_manager: [
    { title: "מרכז רשת", body: "ראו את הרשתות, הגנים, האזורים והמדדים שהוקצו לכם.", href: "/dashboard/admin/enterprise" },
    { title: "מדדים והשוואות", body: "בדקו ביצועים, ציות, בטיחות ומגמות רוחביות.", href: "/dashboard/admin/analytics-center" },
    { title: "פיקוח אזורי", body: "עקבו אחרי כיסוי ביקורות, פערים וממצאים פתוחים.", href: "/dashboard/admin/national-inspections" },
    { title: "כספים", body: "בדקו מנויים רשתיים וחידושים קרובים בהרשאה שלכם.", href: "/dashboard/admin/billing" },
    { title: "משימות", body: "ראו פעולות פתוחות לרשת ולגנים המשויכים.", href: "/dashboard/tasks" }
  ],
  manager: [
    { title: "פרופיל הגן", body: "שם, לוגו, כתובת, קשר וקבוצות גיל צריכים להיות ברורים להורים.", href: "/dashboard/garden/settings" },
    { title: "הוספת צוות", body: "הוסיפו אנשי צוות ובדקו מסמכים בסיסיים לפני עבודה מלאה.", href: "/dashboard/garden/staff" },
    { title: "הוספת ילדים", body: "אשרו ילדים שממתינים או השלימו פרטים חסרים.", href: "/dashboard/garden/children?status=pending" },
    { title: "הורים ופניות", body: "בדקו בקשות הצטרפות והודעות מהורים.", href: "/dashboard/garden/leads" },
    { title: "חיבור מצלמות", body: "הוסיפו מצלמות והגדירו מי יכול לצפות.", href: "/dashboard/garden/cameras" },
    { title: "תצפיתן דיגיטלי", body: "בדקו מה דורש בדיקה ושמרו על שפה רגועה.", href: "/dashboard/garden/observer-intelligence" },
    { title: "מנוי ותשלום", body: "וודאו שפרטי המנוי והתשלום ברורים.", href: "/dashboard/garden/subscription" },
    { title: "סיום הכנה", body: "חזרו לדשבורד וראו מה דורש טיפול עכשיו.", href: "/dashboard/garden" }
  ],
  owner: [
    { title: "פרופיל ומוכנות גן", body: "בדקו שהגן מוצג נכון ושכל פרטי הקשר מלאים.", href: "/dashboard/garden/settings" },
    { title: "צוות", body: "וודאו שהצוות משויך ושהמסמכים החשובים קיימים.", href: "/dashboard/garden/staff" },
    { title: "ילדים והורים", body: "בדקו קליטת ילדים, הורים ובקשות הצטרפות.", href: "/dashboard/garden/onboarding" },
    { title: "כספים", body: "עברו על גבייה, מנוי ותשלומים פתוחים.", href: "/dashboard/garden/finance" },
    { title: "מצלמות ותצפיתן", body: "בדקו חיבורי מצלמות ואירועים לבדיקה.", href: "/dashboard/garden/cameras" },
    { title: "משימות פתוחות", body: "ראו מה ממתין לטיפול תפעולי.", href: "/dashboard/garden/tasks" }
  ],
  inspector: [
    { title: "פרופיל ושיוך", body: "וודאו שהפרטים מלאים ושמופיעים הגנים שהוקצו לכם.", href: "/dashboard/inspector/settings" },
    { title: "גנים משויכים", body: "עברו על רשימת הגנים והמצב האחרון שלהם.", href: "/dashboard/inspector" },
    { title: "ביקורות ממתינות", body: "פתחו ביקורות לפי תאריך יעד.", href: "/dashboard/inspector/inspections/due" },
    { title: "מילוי דוח", body: "המשיכו לטופס ביקורת ושמרו טיוטה כשצריך.", href: "/dashboard/inspector/inspections" },
    { title: "ליקויים פתוחים", body: "עקבו אחרי תיקונים וסטטוס טיפול.", href: "/dashboard/inspector/violations" },
    { title: "דוחות", body: "מצאו דוחות וסיכומים שכבר הוגשו.", href: "/dashboard/inspector/reports" }
  ],
  staff: [
    { title: "השלמת פרופיל", body: "תמונה, טלפון ופרטים בסיסיים עוזרים למנהלת לזהות אתכם.", href: "/dashboard/staff/settings" },
    { title: "נוכחות", body: "למדו איפה מסמנים כניסה ויציאה.", href: "/dashboard/staff/attendance" },
    { title: "ילדים לעדכון", body: "ראו את הילדים שצריך לעדכן ביומן היומי.", href: "/dashboard/staff/child-journal" },
    { title: "משימות", body: "בדקו משימות שהמנהלת פתחה להיום.", href: "/dashboard/staff/tasks" },
    { title: "דיווח אירוע", body: "אם קרה משהו חריג, כאן מתעדים בצורה קצרה.", href: "/dashboard/staff/incidents" },
    { title: "מסמכים", body: "השלימו תעודות ואישורים חסרים.", href: "/dashboard/staff/documents" }
  ],
  parent: [
    { title: "אימות חשבון", body: "בדקו שהשם ופרטי הקשר שלכם נכונים.", href: "/dashboard/parent/settings" },
    { title: "חיבור לגן", body: "וודאו שהגן והילד מופיעים בדשבורד.", href: "/dashboard/parent" },
    { title: "השלמת פרטי ילד", body: "בריאות, תמונות, מורשי איסוף והצהרות במקום אחד.", href: "/parent-onboarding" },
    { title: "הרשאות ואיסוף", body: "בדקו מי מורשה לאסוף את הילד ומתי.", href: "/dashboard/parent/pickup" },
    { title: "התראות", body: "ראו איפה מופיעים עדכונים חשובים מהגן.", href: "/dashboard/parent/notifications" },
    { title: "מסמכים", body: "השלימו מסמכים חסרים או בדקו סטטוס אישור.", href: "/dashboard/parent/documents" }
  ]
};

export function RoleOnboardingGuide({ role }: { role: UserRole }) {
  const storageKey = `gan-batuach-guide-${role}`;
  const progressKey = `gan-batuach-guide-progress-${role}`;
  const [visible, setVisible] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const steps = useMemo(() => stepsByRole[role], [role]);
  const welcome = welcomeByRole[role];
  const completedPercent = Math.round((completed.length / steps.length) * 100);
  const nextStep = steps.find((step) => !completed.includes(step.href)) ?? steps[steps.length - 1];

  useEffect(() => {
    setVisible(window.localStorage.getItem(storageKey) !== "dismissed");
    setCompleted(JSON.parse(window.localStorage.getItem(progressKey) || "[]"));
  }, [storageKey, progressKey]);

  useEffect(() => {
    function handleOpen(event: Event) {
      const detail = (event as CustomEvent<{ role?: UserRole; resetProgress?: boolean }>).detail;
      if (detail?.role && detail.role !== role) return;
      if (detail?.resetProgress) {
        window.localStorage.removeItem(progressKey);
        setCompleted([]);
      }
      window.localStorage.removeItem(storageKey);
      setVisible(true);
    }
    window.addEventListener("gan-batuach-open-guide", handleOpen);
    return () => window.removeEventListener("gan-batuach-open-guide", handleOpen);
  }, [progressKey, role, storageKey]);

  function dismiss() {
    window.localStorage.setItem(storageKey, "dismissed");
    setVisible(false);
  }

  function markStep(href: string) {
    const next = Array.from(new Set([...completed, href]));
    window.localStorage.setItem(progressKey, JSON.stringify(next));
    setCompleted(next);
  }

  if (!visible) return null;

  return (
    <motion.aside className="role-guide-card first-login-guide-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <div className="role-guide-heading">
        <span><Sparkles size={18} /> {welcome.eyebrow}</span>
        <button type="button" onClick={dismiss} aria-label="סגירת מדריך"><X size={16} /></button>
      </div>
      <div className="first-login-copy">
        <h2>{completedPercent === 100 ? welcome.done : welcome.title}</h2>
        <p>{welcome.intro}</p>
      </div>
      <div className="onboarding-progress">
        <span>התקדמות התחלה: {completedPercent}%</span>
        <i style={{ width: `${completedPercent}%` }} />
      </div>
      <a className="next-onboarding-step" href={nextStep.href} onClick={() => markStep(nextStep.href)}>
        <small>הצעד הבא</small>
        <strong>{nextStep.title}</strong>
        <span>{nextStep.body}</span>
      </a>
      <div className="role-guide-steps">
        {steps.map((step, index) => (
          <a href={step.href} key={step.href} onClick={() => markStep(step.href)} className={completed.includes(step.href) ? "complete" : ""}>
            <b>{index + 1}</b>
            <span><strong>{step.title}</strong><small>{step.body}</small></span>
            <CheckCircle2 size={18} />
          </a>
        ))}
      </div>
      <div className="role-guide-footer"><Compass size={16} /> אפשר לסגור את המדריך. הוא לא משנה נתונים ולא יוצר פעולות לבד.</div>
    </motion.aside>
  );
}
