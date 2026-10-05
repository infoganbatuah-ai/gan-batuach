"use client";

import { GlobalErrorState } from "@/components/global-error-state";

export function DashboardErrorState({ reset }: { reset?: () => void }) {
  return <main className="dashboard-safe-state" dir="rtl"><GlobalErrorState reset={reset} title="אירעה שגיאה בטעינת הנתונים" description="לא הצלחנו להציג את המידע כרגע. אפשר לנסות שוב בלי לחשוף פרטי מערכת פנימיים." /></main>;
}
