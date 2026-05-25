import { FlaskConical } from "lucide-react";

export function SandboxModeBanner() {
  if (process.env.NEXT_PUBLIC_SANDBOX_MODE !== "true") return null;

  return (
    <div className="sandbox-mode-banner">
      <FlaskConical size={18} />
      <div>
        <strong>מצב תרגול פעיל</strong>
        <span>המערכת רצה בסביבת בדיקות. פעולות נשמרות רק בסביבת Supabase המחוברת כרגע.</span>
      </div>
    </div>
  );
}
