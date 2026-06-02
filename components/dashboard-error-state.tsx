"use client";

import { RotateCcw } from "lucide-react";

export function DashboardErrorState({ reset }: { reset?: () => void }) {
  return (
    <main className="dashboard-safe-state" dir="rtl">
      <div className="safe-state-card error">
        <span className="pill bad">שגיאת טעינה</span>
        <div>
          <p className="eyebrow">Gan Batuach</p>
          <h1>אירעה שגיאה בטעינת הנתונים</h1>
          <p>העמוד לא קרס. ייתכן שחסר מידע, שקיים קשר ריק בנתונים, או שהחיבור ל־Supabase החזיר שגיאה זמנית.</p>
        </div>
        <div className="actions">
          <button className="button primary" type="button" onClick={() => reset?.()}>
            <RotateCcw size={16} />
            טעינה מחדש
          </button>
          <button className="button secondary" type="button" onClick={() => window.location.reload()}>
            רענון מלא
          </button>
        </div>
      </div>
    </main>
  );
}
