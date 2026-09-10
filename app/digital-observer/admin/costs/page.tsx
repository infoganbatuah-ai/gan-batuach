import Link from "next/link";
import { Activity, CircleDollarSign, Database, Gauge, ShieldCheck } from "lucide-react";
import { ObserverAppShell } from "@/components/digital-observer/observer-app-shell";
import { requireDigitalObserverAdmin } from "@/lib/domain/digital-observer/admin-access";
import { loadCostIntelligence } from "@/lib/domain/digital-observer/cost-intelligence-data";

const labels: Record<string, string> = { AI_INFERENCE: "עיבוד AI", CPU_COMPUTE: "CPU", GPU_COMPUTE: "GPU", EDGE_COMPUTE: "עיבוד מקומי", BANDWIDTH_INGRESS: "תעבורה נכנסת", BANDWIDTH_EGRESS: "תעבורה יוצאת", STORAGE: "אחסון", EVIDENCE_STORAGE: "אחסון ראיות", DATABASE: "מסד נתונים", PLATFORM_HOSTING: "אירוח", NOTIFICATION: "התראות", EXTERNAL_PROVIDER: "ספק חיצוני" };
const money = (value: number, currency: string) => new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 6 }).format(value);

export default async function DigitalObserverAdminCostsPage() {
  const { profile } = await requireDigitalObserverAdmin("/digital-observer/admin/costs");
  const data = await loadCostIntelligence();
  const totals = Object.entries(data.report.totals_by_currency as Record<string, number>);
  const categories = Object.entries(data.report.by_category as Record<string, { usage_events: number; known_cost: number; unknown_cost_events: number }>);
  return <ObserverAppShell profile={profile} mode="admin" activeHref="/digital-observer/admin/costs" title="עלות תפעולית" statusLabel="עלות תשתית בלבד — לא מחיר לקוח">
    <div className="do-page-stack">
      {!data.available ? <div className="do-notice warn"><Activity/><span>טלמטריית העלות עדיין אינה זמינה בסביבה זו. אין הצגת עלות חלופית או מומצאת.</span></div> : null}
      <section className="do-business-summary">
        <article className="do-metric"><Gauge/><strong>{data.report.usage_events}</strong><span>אירועי שימוש</span></article>
        <article className="do-metric"><CircleDollarSign/><strong>{data.report.known_cost_events}</strong><span>עלויות מחושבות</span></article>
        <article className="do-metric"><Database/><strong>{data.report.unknown_cost_events}</strong><span>ללא תעריף מאומת</span></article>
        <article className="do-metric"><ShieldCheck/><strong>{data.providerReconciliation === "AVAILABLE" ? "זמין" : "לא זמין"}</strong><span>התאמת חשבון ספק</span></article>
      </section>
      <section className="do-grid cols-2">
        <article className="do-panel"><div className="do-section-head"><div><h2>עלות ידועה לפי מטבע</h2><p>מטבעות לעולם אינם מעורבבים. אומדן והקצאה מסומנים בנפרד.</p></div><CircleDollarSign/></div>
          <div className="do-summary-list">{totals.length ? totals.map(([currency, value]) => <div key={currency}><span>{currency}</span><strong>{money(value, currency)}</strong></div>) : <div><span>עלות כספית מאומתת</span><strong>עדיין לא ניתנת לחישוב</strong></div>}</div></article>
        <article className="do-panel"><div className="do-section-head"><div><h2>אמינות ייחוס</h2><p>מדידה ישירה, התאמת ספק, הקצאה ואומדן נשמרים כמצבים שונים.</p></div><ShieldCheck/></div>
          <div className="do-summary-list">{Object.entries(data.report.by_attribution_quality as Record<string, number>).map(([quality, count]) => <div key={quality}><span>{quality}</span><strong>{count}</strong></div>)}</div></article>
      </section>
      <section className="do-panel"><div className="do-section-head"><div><h2>משאבים</h2><p>שישה ערוצי DVR ריקים אינם מצלמות ואינם מקבלים עלות AI מצלמה.</p></div><Database/></div>
        {categories.length ? <div className="do-summary-list">{categories.map(([category, value]) => <div key={category}><span>{labels[category] ?? category}</span><strong>{value.usage_events} רשומות · {value.unknown_cost_events} ללא תעריף</strong></div>)}</div> : <div className="do-empty compact"><Database/><strong>אין עדיין אירועי עלות בסביבה זו</strong><span>המערכת אינה מציגה 0 כתחליף לנתוני ספק חסרים.</span></div>}
      </section>
      <section className="do-panel"><div className="do-section-head"><div><h2>גבולות בטיחות</h2><p>עלות אינה Billing, ואינה עוקפת איכות, פרטיות או כשירות יעד.</p></div><ShieldCheck/></div>
        <div className="do-summary-list"><div><span>מחיר לקוח</span><strong>לא כלול</strong></div><div><span>שינוי ניתוב אוטומטי</span><strong>לא מבוצע ב־PUSH 33</strong></div><div><span>נתוני ספק חסרים</span><strong>NOT RECONCILED</strong></div></div>
        <Link className="do-link" href="/api/digital-observer/admin/costs?format=csv">ייצוא CSV מורשה</Link>
      </section>
    </div>
  </ObserverAppShell>;
}
