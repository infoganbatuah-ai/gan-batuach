"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/browser";

const reportSchema = z.object({
  passed: z.boolean(), cleanup: z.enum(["complete", "not_created", "failed"]), checks: z.array(z.string()),
  failed_step: z.string().nullable(), fixture_site_id: z.string().uuid(), commit: z.string(),
  branch: z.literal("codex/digital-guard-engine-eeb919c"), synthetic_metrics_only: z.literal(true), hardware_actions: z.literal(0)
});

export function GuardLearningQaPanel({ commit }: { commit: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<z.infer<typeof reportSchema> | null>(null);
  const busy = useRef(false);
  async function run() {
    if (!confirmed || busy.current) return;
    busy.current = true; setPending(true); setReport(null); setMessage("הבדיקה פועלת. אין לרענן או לשלוח בקשה נוספת.");
    try {
      const { data, error } = await createClient().auth.getSession();
      if (error || !data.session) { setMessage("נדרשת התחברות מחדש לחשבון הבדיקות."); return; }
      const response = await fetch("/api/digital-observer/qa/learning-fixture", {
        method: "POST", redirect: "error", credentials: "same-origin", signal: AbortSignal.timeout(90_000),
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ run_isolated_fixture: true, expected_commit: commit })
      });
      const result = await response.json();
      const parsed = reportSchema.safeParse(result?.data);
      if (!parsed.success || parsed.data.commit !== commit) {
        setMessage(response.status === 401 ? "הגישה נדחתה. יש לוודא כניסה תקינה גם ל־Vercel וגם לחשבון הבדיקות." : "לא התקבל דוח בדיקה תקין. אין לשלוח שוב לפני בירור התוצאה.");
        return;
      }
      setReport(parsed.data);
      setMessage(response.ok && parsed.data.passed && parsed.data.cleanup === "complete"
        ? "הבדיקה עברה והניקוי אומת. לא הופעלה חומרה."
        : "הבדיקה לא הושלמה בהצלחה. יש לבדוק את הדוח לפני ניסיון נוסף.");
    } catch {
      setMessage("החיבור נקטע ותוצאת הבדיקה אינה ידועה. ייתכן שנוצרו נתוני בדיקה; אין להריץ שוב לפני בדיקת הניקוי.");
    } finally {
      busy.current = false; setPending(false); setConfirmed(false);
    }
  }
  return <section className="do-panel do-form-section">
    <label><input type="checkbox" checked={confirmed} disabled={pending} onChange={(event) => setConfirmed(event.target.checked)} /> אני מאשר יצירת נתוני בדיקה סינתטיים וניקוי שלהם בסיום.</label>
    <button type="button" className="do-button primary" disabled={!confirmed || pending} onClick={run}>{pending ? "הבדיקה מתבצעת…" : "הרצת בדיקת למידה מבודדת"}</button>
    <p role="status" aria-live="polite">{message}</p>
    {report ? <dl>
      <dt>בדיקות שאומתו</dt><dd>{report.checks.length}</dd>
      <dt>ניקוי נתונים</dt><dd>{report.cleanup === "complete" ? "הושלם ואומת" : report.cleanup === "not_created" ? "לא נוצר אתר בהרצה זו" : "נכשל — נדרש טיפול"}</dd>
      <dt>מזהה אתר הבדיקה</dt><dd><code dir="ltr">{report.fixture_site_id}</code></dd>
      {report.failed_step ? <><dt>שלב שלא הושלם</dt><dd><code dir="ltr">{report.failed_step}</code></dd></> : null}
    </dl> : null}
  </section>;
}
