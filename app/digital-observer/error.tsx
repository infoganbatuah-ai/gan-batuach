"use client";

import Link from "next/link";
import { RefreshCw, ShieldAlert } from "lucide-react";

export default function DigitalObserverError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="do-route-state error" dir="rtl" role="alert">
      <div className="do-route-state-mark"><ShieldAlert /></div>
      <h1>לא הצלחנו לטעון את מסך התצפיתן</h1>
      <p>לא הוצג מידע חלופי או מצב חי מדומה. אפשר לנסות שוב או לחזור למסך הבית.</p>
      <div className="do-button-row">
        <button className="do-button primary" type="button" onClick={reset}><RefreshCw /> ניסיון נוסף</button>
        <Link className="do-button secondary" href="/digital-observer/dashboard">חזרה לדשבורד</Link>
      </div>
    </main>
  );
}
