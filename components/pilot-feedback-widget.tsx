"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareText, Send, X } from "lucide-react";
import type { UserRole } from "@/lib/roles";

const categories = [
  { value: "onboarding", label: "קליטה" },
  { value: "dashboard", label: "דשבורד" },
  { value: "cameras", label: "מצלמות" },
  { value: "observer", label: "תצפיתן" },
  { value: "finance", label: "כספים" },
  { value: "staff", label: "צוות" },
  { value: "children", label: "ילדים" },
  { value: "parent_experience", label: "הורים" },
  { value: "inspections", label: "פיקוח" },
  { value: "performance", label: "מהירות" },
  { value: "bug_report", label: "תקלה" },
  { value: "feature_request", label: "בקשה" }
] as const;

function defaultCategory(role: UserRole) {
  if (role === "parent") return "parent_experience";
  if (role === "staff") return "staff";
  if (role === "inspector") return "inspections";
  if (role === "manager" || role === "owner") return "dashboard";
  return "dashboard";
}

export function PilotFeedbackWidget({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sentiment, setSentiment] = useState<"easy" | "confusing" | "neutral">("neutral");
  const [category, setCategory] = useState(defaultCategory(role));
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "sent" | "error">("idle");

  async function submit(nextSentiment = sentiment) {
    setStatus("saving");
    try {
      const response = await fetch("/api/pilot-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          sentiment: nextSentiment,
          rating: nextSentiment === "easy" ? 5 : nextSentiment === "confusing" ? -1 : 0,
          comment,
          page_path: pathname,
          severity: category === "bug_report" ? "major" : "minor"
        })
      });
      if (!response.ok) throw new Error("feedback failed");
      setStatus("sent");
      setComment("");
      window.setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1200);
    } catch {
      setStatus("error");
    }
  }

  return (
    <aside className={open ? "pilot-feedback-widget open" : "pilot-feedback-widget"} aria-label="משוב פיילוט">
      {open ? (
        <div className="pilot-feedback-panel">
          <div className="pilot-feedback-heading">
            <div><span>משוב קצר</span><strong>איך המסך הזה מרגיש?</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="סגירת משוב"><X size={16} /></button>
          </div>
          <div className="pilot-sentiment-row">
            <button type="button" className={sentiment === "easy" ? "active" : ""} onClick={() => { setSentiment("easy"); void submit("easy"); }}>👍 קל</button>
            <button type="button" className={sentiment === "confusing" ? "active" : ""} onClick={() => { setSentiment("confusing"); setOpen(true); }}>👎 מבלבל</button>
          </div>
          <label>
            מה הנושא?
            <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
              {categories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            מה כדאי שנדע?
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="משהו לא ברור, חסר או לוקח יותר מדי זמן?" />
          </label>
          <button className="button primary" type="button" onClick={() => submit()} disabled={status === "saving"}>
            <Send size={15} /> {status === "saving" ? "שומר..." : "שליחת משוב"}
          </button>
          {status === "sent" ? <p className="pilot-feedback-ok">תודה, המשוב נשמר לצוות הפיילוט.</p> : null}
          {status === "error" ? <p className="pilot-feedback-error">לא הצלחנו לשמור כרגע. נסו שוב בעוד רגע.</p> : null}
        </div>
      ) : (
        <button className="pilot-feedback-toggle" type="button" onClick={() => setOpen(true)}><MessageSquareText size={16} /> משוב</button>
      )}
    </aside>
  );
}
