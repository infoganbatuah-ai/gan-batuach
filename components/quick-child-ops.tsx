"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Moon, Shirt, Smile, Utensils } from "lucide-react";

const journalChips = [
  { label: "אכל הכל", field: "meals", value: "אכל הכל", icon: Utensils },
  { label: "ישן טוב", field: "sleep_summary", value: "ישן טוב", icon: Moon },
  { label: "שמח", field: "mood", value: "שמח", icon: Smile },
  { label: "עייף", field: "mood", value: "עייף", icon: Smile }
];

export function QuickChildOps({ childId, gardenId }: { childId: string; gardenId?: string | null }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function saveJournal(field: string, value: string) {
    if (!gardenId) return setMessage("חסר שיוך גן לעדכון מהיר.");
    setMessage("");
    startTransition(async () => {
      const body: Record<string, unknown> = {
        garden_id: gardenId,
        child_id: childId,
        meals: field === "meals" ? [{ title: "עדכון מהיר", note: value }] : [],
        sleep_summary: field === "sleep_summary" ? value : "",
        mood: field === "mood" ? value : "",
        staff_signature: "עדכון מהיר"
      };
      const response = await fetch("/api/child-daily-journals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setMessage(response.ok ? "נשמר ונשלחה התראה להורה." : "לא ניתן לשמור כרגע.");
    });
  }

  function saveClothes(missing: boolean) {
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/garden/children/${childId}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_clothes", has_change_clothes: !missing, change_clothes_notes: missing ? "נא להביא בגדים להחלפה" : "סומן שיש בגדים להחלפה" })
      });
      setMessage(response.ok ? "סטטוס בגדים עודכן." : "לא ניתן לעדכן בגדים כרגע.");
    });
  }

  function saveAttendance(status: "present" | "absent") {
    if (!gardenId) return setMessage("חסר שיוך גן לעדכון נוכחות.");
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garden_id: gardenId, child_id: childId, status })
      });
      setMessage(response.ok ? "נוכחות עודכנה." : "לא ניתן לעדכן נוכחות כרגע.");
    });
  }

  return (
    <div className="quick-child-ops" aria-label="פעולות מהירות לילד">
      <button type="button" disabled={pending} onClick={() => saveAttendance("present")}><CheckCircle2 size={14} /> הגיע</button>
      <button type="button" disabled={pending} onClick={() => saveAttendance("absent")}>נעדר</button>
      {journalChips.map((chip) => <button type="button" disabled={pending} onClick={() => saveJournal(chip.field, chip.value)} key={chip.label}><chip.icon size={14} /> {chip.label}</button>)}
      <button type="button" disabled={pending} onClick={() => saveClothes(true)}><Shirt size={14} /> חסר בגדים</button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
