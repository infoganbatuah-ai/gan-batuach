import { FlaskConical } from "lucide-react";

export function SandboxModeBanner() {
  const environment = String(process.env.NEXT_PUBLIC_APP_ENV || "demo").toLowerCase();
  const forcedSandbox = process.env.NEXT_PUBLIC_SANDBOX_MODE === "true";
  if (environment === "production" && !forcedSandbox) return null;

  const labels: Record<string, { title: string; detail: string }> = {
    local: {
      title: "סביבת פיתוח מקומית",
      detail: "מיועדת לפיתוח בלבד. אין להזין מידע של ילדים או הורים אמיתיים."
    },
    demo: {
      title: "סביבת Demo סינתטית",
      detail: "הנתונים מיועדים לבדיקות בלבד. שירותי תשלום, מצלמות, AI והודעות חיצוניות אינם חיים."
    },
    staging: {
      title: "סביבת בדיקות",
      detail: "מיועדת ל-QA עם משתמשים ונתונים סינתטיים בלבד."
    },
    pilot: {
      title: "סביבת פיילוט מבוקר",
      detail: "יש לפעול רק לפי היקף הפיילוט המאושר. שירותי Live נשארים חסומים ללא אישור הפעלה נפרד."
    }
  };
  const copy = labels[environment] ?? labels.demo;

  return (
    <div className="sandbox-mode-banner">
      <FlaskConical size={18} />
      <div>
        <strong>{copy.title}</strong>
        <span>{copy.detail}</span>
      </div>
    </div>
  );
}
