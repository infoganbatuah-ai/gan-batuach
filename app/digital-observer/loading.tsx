import { LoaderCircle, ShieldCheck } from "lucide-react";

export default function DigitalObserverLoading() {
  return (
    <main className="do-route-state" dir="rtl" aria-live="polite" aria-busy="true">
      <div className="do-route-state-mark"><ShieldCheck /><LoaderCircle className="do-spin" /></div>
      <h1>התצפיתן מכין את התמונה העדכנית</h1>
      <p>טוענים מצלמות, אירועים והרשאות בלי להציג נתונים חלקיים.</p>
      <div className="do-route-state-lines" aria-hidden="true"><span /><span /><span /></div>
    </main>
  );
}
