"use client";

import { useState, useTransition } from "react";
import { useEffect } from "react";
import { Activity, Bot, Camera, ClipboardCheck, Database, FileWarning, RotateCcw, Siren } from "lucide-react";

const actions = [
  { action: "load_demo_data", label: "Load demo data", text: "יוצר/מאתר גן דמו מהיר ומוסיף התראת מערכת. לדמו מלא: npm run seed:demo-full", icon: Database },
  { action: "reset_demo_data", label: "Reset demo data", text: "מוחק רק את batch הדמו הנוכחי לפי demo_batch_id.", icon: RotateCcw, danger: true },
  { action: "delete_demo_data", label: "Delete demo data", text: "מוחק רק רשומות שמסומנות is_demo=true בכל batches הדמו.", icon: RotateCcw, danger: true },
  { action: "create_sample_inspection", label: "דוח פיקוח לדוגמה", text: "יוצר ביקורת חתומה עם תשובות ו-GPS.", icon: ClipboardCheck },
  { action: "create_sample_complaint", label: "פנייה לדוגמה", text: "יוצר תלונת בטיחות עם SLA.", icon: Siren },
  { action: "create_sample_ai_event", label: "אירוע AI לדוגמה", text: "יוצר אירוע child_alone לניהול אדמין.", icon: Bot },
  { action: "create_sample_late_inspection", label: "פיקוח באיחור", text: "יוצר דרישת פיקוח אדומה באיחור.", icon: FileWarning },
  { action: "create_sample_camera_issue", label: "תקלה במצלמה", text: "יוצר מצלמה במצב pending_gateway.", icon: Camera }
];

export function DemoControlPanel() {
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<{ demo_batch_id: string; demo_records: number; configured: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refreshStatus() {
    const response = await fetch("/api/admin/demo-control", { cache: "no-store" });
    const body = await response.json();
    setStatus(body.data ?? null);
  }

  useEffect(() => {
    refreshStatus().catch(() => setStatus(null));
  }, []);

  function run(action: string) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/demo-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await response.json();
      setMessage(body.data?.message || body.error || "הפעולה הסתיימה.");
      await refreshStatus().catch(() => {});
    });
  }

  return (
    <section className="dashboard-section">
      <div className="section-heading"><h2><Activity size={20} /> פעולות דמו ו-QA</h2><p>כל כפתור מפעיל פעולה אמיתית מול Supabase או מציג סיבה ברורה אם חסרה תשתית.</p></div>
      <div className="warning-banner">פעולה זו מוחקת נתוני דמו בלבד ולא נוגעת בנתוני אמת. המחיקה מתבצעת רק על רשומות עם <b>is_demo=true</b> או batch דמו נבחר.</div>
      <div className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><h2>Current demo batch id</h2><p>{status?.demo_batch_id ?? "טוען..."}</p></article>
        <article className="card action-panel"><h2>Demo records</h2><p>{status ? `${status.demo_records} רשומות דמו` : "טוען..."}</p></article>
      </div>
      {message ? <div className={message.includes("נכשל") || message.includes("חסר") ? "error-banner" : "success-banner"}>{message}</div> : null}
      <div className="quick-actions-grid">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <button className={item.danger ? "quick-action danger-action" : "quick-action"} type="button" onClick={() => run(item.action)} disabled={isPending} key={item.action}>
              <Icon />
              <strong>{isPending ? "מבצע..." : item.label}</strong>
              <span>{item.text}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
