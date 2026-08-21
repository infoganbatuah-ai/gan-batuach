import { LoaderCircle, ShieldCheck } from "lucide-react";

export default function DigitalObserverAdminLoading() {
  return <main className="do-route-state" dir="rtl" aria-busy="true"><span className="do-route-state-mark"><ShieldCheck /><LoaderCircle className="do-spin" /></span><h1>מרכז הבקרה נטען</h1><p>טוענים נתוני אתרים, מצלמות, אירועים ומנויים ללא חשיפת מדיה או סודות.</p><div className="do-route-state-lines" aria-hidden="true"><span /><span /><span /></div></main>;
}
