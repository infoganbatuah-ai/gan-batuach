"use client";

import { RotateCcw, ShieldAlert } from "lucide-react";

export default function DigitalObserverAdminError({ reset }: { reset: () => void }) {
  return <main className="do-route-state" dir="rtl"><span className="do-route-state-mark"><ShieldAlert /></span><h1>מרכז הבקרה אינו זמין כרגע</h1><p>לא מוצגים נתוני fallback מזויפים. אפשר לנסות שוב, והמערכת תמשיך לשמור על הפרדת התצפיתן מגן בטוח.</p><button className="do-button primary" type="button" onClick={reset}><RotateCcw /> ניסיון נוסף</button></main>;
}
