import Link from "next/link";
import { Camera, Clock3 } from "lucide-react";
import { observerSourceCoverage } from "@/lib/domain/digital-observer/source-coverage";
import { formatObserverDate } from "@/lib/domain/digital-observer/runtime";

const analysisLabels: Record<string, string> = {
  no_event: "הסבב הסתיים ללא ממצא", event_detected: "זוהה ממצא בסבב", no_media: "הסבב לא קיבל וידאו",
  processing_failed: "הניתוח נכשל", offline: "המקור לא זמין לניתוח", deferred_budget: "הסבב נדחה עקב עומס",
  consent_unavailable: "אין הרשאה לסבב", stale: "דיווח הסבב אינו עדכני", not_reported: "סבב ניתוח טרם דווח"
};

export function ObserverSourceCoverage({ siteId, cameras, signals, available, limited, analysisReports = [], analysisAvailable = false }: {
  siteId: string; cameras: Record<string, any>[]; signals: Record<string, any>[]; available: boolean; limited: boolean;
  analysisReports?: Record<string, any>[]; analysisAvailable?: boolean;
}) {
  const rows = observerSourceCoverage(siteId, cameras, signals, Date.now(), analysisAvailable ? analysisReports : []);
  if (!rows.length) return null;
  return <section className="do-source-coverage" aria-label="כיסוי לפי מצלמה">
    <div className="do-section-head"><div><h2>כיסוי לפי מצלמה</h2><p>48 השעות האחרונות · דיווחים שמורים בלבד</p></div><span>{rows.length} מקורות</span></div>
    <p className="do-source-coverage-notice">{!available ? "דיווחי האירועים לא נטענו כרגע." : limited ? "רשימת הדיווחים שנטענה חלקית; הספירות אינן סיכום מלא." : "הספירות מתייחסות לדיווחים שנשמרו, לא לסריקת הקלטות."} {!analysisAvailable ? "דיווחי סבבי הניתוח אינם זמינים כרגע." : "דיווח על סבב אינו מעיד על ניתוח רציף."} חוסר דיווחים אינו מעיד שלא הייתה פעילות.</p>
    <details><summary>פירוט הכיסוי של {rows.length} המקורות</summary><div className="do-source-coverage-list">{rows.map(row => <article key={row.id}>
      <Link className="do-source-coverage-name" href={`/digital-observer/cameras?site=${siteId}&camera=${row.id}`}><Camera /><span><strong>{row.name}</strong><small>{row.zone || "אזור טרם הוגדר"}</small></span></Link>
      <span>{row.connection === "offline" ? "מנותקת לפי דיווח" : row.connection === "reported_connected" ? "מחוברת לפי דיווח" : "מצב החיבור לא אומת"}</span>
      <Link href={`/digital-observer/alerts?site=${siteId}&camera=${row.id}`}>{available ? `${row.savedRecords} דיווחים שנטענו` : "יומן האירועים"}</Link>
      <span className="do-source-coverage-time"><Clock3 />{available && row.lastRecordAt ? `דיווח אחרון: ${formatObserverDate(row.lastRecordAt)}` : "אין דיווח אחרון זמין"}<small>{analysisLabels[row.analysisState]}</small><small>{row.lastAnalyzedAt ? `ניתוח בסבב האחרון: ${formatObserverDate(row.lastAnalyzedAt)}` : row.lastReportedAt ? "בסבב האחרון לא אומת ניתוח" : "ניתוח אחרון: לא דווח"}</small></span>
    </article>)}</div></details>
  </section>;
}
