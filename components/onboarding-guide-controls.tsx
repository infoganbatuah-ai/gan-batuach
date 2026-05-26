"use client";

import type { UserRole } from "@/lib/roles";
import { HelpCircle, RotateCcw } from "lucide-react";

export function OnboardingGuideControls({ role }: { role: UserRole }) {
  function reopen(resetProgress = false) {
    localStorage.removeItem(`gan-batuach-guide-${role}`);
    if (resetProgress) localStorage.removeItem(`gan-batuach-guide-progress-${role}`);
    window.dispatchEvent(new CustomEvent("gan-batuach-open-guide", { detail: { role, resetProgress } }));
  }

  return (
    <div className="guide-control-row">
      <button className="button secondary tiny" type="button" onClick={() => reopen(false)}><HelpCircle size={14} /> הצג מדריך שימוש</button>
      <button className="button tiny" type="button" onClick={() => reopen(true)}><RotateCcw size={14} /> התחל הדרכה מחדש</button>
    </div>
  );
}
