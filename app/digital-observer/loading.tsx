import { LoaderCircle, ShieldCheck } from "lucide-react";

export default function DigitalObserverLoading() {
  return (
    <div className="do-route-state" dir="rtl" role="status" aria-live="polite" aria-busy="true">
      <div className="do-route-state-mark"><ShieldCheck /><LoaderCircle className="do-spin" /></div>
      <strong className="do-route-state-title">התצפיתן מכין את התמונה העדכנית</strong>
      <p>טוענים מצלמות, אירועים והרשאות בלי להציג נתונים חלקיים.</p>
      <div className="do-route-state-lines" aria-hidden="true"><span /><span /><span /></div>
    </div>
  );
}
