"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Compass, Sparkles, X } from "lucide-react";
import type { UserRole } from "@/lib/roles";

const stepsByRole: Record<UserRole, Array<{ title: string; body: string; href: string }>> = {
  admin: [
    { title: "בדקו בריאות מערכת", body: "עברו על גנים בלי פקח, מסמכים חסרים ופיקוחים באיחור.", href: "/dashboard/admin/system-health" },
    { title: "טפלו בלידים ומשתמשים", body: "השלימו פרטי גן או מפקח לפני יצירת משתמש והרשאות.", href: "/dashboard/admin/users" },
    { title: "פתחו משימות פיקוח", body: "דרישות פיקוח, נהלים ודיווחים צריכים להיות מתועדים עם אחראי ותאריך יעד.", href: "/dashboard/admin/inspection-forms" }
  ],
  manager: [
    { title: "השלימו מוכנות גן", body: "בדקו ילדים, צוות, מסמכים, מצלמות ופיקוח ראשון.", href: "/dashboard/garden/inspection-status" },
    { title: "עדכנו יומן ילדים", body: "הורים מקבלים תמונה ברורה של יום הילד רק אחרי שמירה מאושרת.", href: "/dashboard/garden/child-journal" },
    { title: "בדקו בריאות ואיסוף", body: "אלרגיות, תרופות ומורשי איסוף חייבים להיות מעודכנים לפני פעילות.", href: "/dashboard/garden/health" }
  ],
  owner: [
    { title: "ראו מוכנות תפעולית", body: "עקבו אחרי מסמכים, צוות, פיקוח ומצלמות בלי להתערב בזהות המנהלת.", href: "/dashboard/garden/inspection-status" },
    { title: "בדקו משימות פתוחות", body: "כל פעולה נשמרת בזהות שלכם כבעלים, בנפרד מהמנהל/ת.", href: "/dashboard/garden/tasks" },
    { title: "עקבו אחרי מסמכים", body: "מסמכי גן, צוות ונהלים משפיעים ישירות על סטטוס המוכנות.", href: "/dashboard/garden/documents" }
  ],
  inspector: [
    { title: "בדקו פיקוחים קרובים", body: "רק גנים שהוקצו אליכם מופיעים ברשימות ובדוחות.", href: "/dashboard/inspector/inspections/due" },
    { title: "הכינו ביקורת חתומה", body: "GPS וחתימה נדרשים לפני סגירת דוח פיקוח.", href: "/dashboard/inspector/inspections" },
    { title: "עקבו אחרי ליקויים", body: "ליקויים, אירועים ומצלמות מוצגים לפי שיוך הגן בלבד.", href: "/dashboard/inspector/violations" }
  ],
  staff: [
    { title: "התחילו בנוכחות", body: "כניסה ויציאה נשמרות עם אימות מיקום מול כתובת הגן.", href: "/dashboard/staff/attendance" },
    { title: "טפלו במשימות היום", body: "משימות, צ׳קליסטים והערות לילדים מופיעים לפי שיוך הכיתה.", href: "/dashboard/staff/tasks" },
    { title: "השלימו מסמכים", body: "אישורי רקע ותעודות נדרשים לפני סטטוס פעיל מלא.", href: "/dashboard/staff/documents" }
  ],
  parent: [
    { title: "בדקו כרטיס ילד", body: "מידע רפואי, הסכמות ומורשי איסוף מגנים על הילד ביום יום.", href: "/parent-onboarding" },
    { title: "עקבו אחרי יומן יומי", body: "עדכוני אוכל, שינה, מצב רוח ותמונות מופיעים אחרי שמירת הצוות.", href: "/dashboard/parent/daily-journal" },
    { title: "פתחו פניות מסודרות", body: "הודעות ותלונות נשמרות עם סטטוס טיפול ושיוך לגן.", href: "/dashboard/parent/complaints" }
  ]
};

export function RoleOnboardingGuide({ role }: { role: UserRole }) {
  const storageKey = `gan-batuach-guide-${role}`;
  const progressKey = `gan-batuach-guide-progress-${role}`;
  const [visible, setVisible] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const steps = useMemo(() => stepsByRole[role], [role]);
  const completedPercent = Math.round((completed.length / steps.length) * 100);

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
    <motion.aside className="role-guide-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <div className="role-guide-heading">
        <span><Sparkles size={18} /> מדריך התחלה מהיר</span>
        <button type="button" onClick={dismiss} aria-label="סגירת מדריך"><X size={16} /></button>
      </div>
      <div className="onboarding-progress">
        <span>התקדמות התחלה: {completedPercent}%</span>
        <i style={{ width: `${completedPercent}%` }} />
      </div>
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
