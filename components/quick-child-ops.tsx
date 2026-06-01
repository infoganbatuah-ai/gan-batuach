"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, MessageCircle, Moon, Shirt, Smile, Utensils } from "lucide-react";

const journalChips = [
  { label: "אכל הכל", field: "meals", value: "אכל הכל", icon: Utensils },
  { label: "לא אכל", field: "meals", value: "לא אכל", icon: Utensils },
  { label: "ישן טוב", field: "sleep_summary", value: "ישן טוב", icon: Moon },
  { label: "לא ישן", field: "sleep_summary", value: "לא ישן", icon: Moon },
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
      const result = await response.json().catch(() => null);
      setMessage(response.ok ? "נשמר ונשלחה התראה להורה." : result?.error || "לא ניתן לשמור כרגע. בדקו שהילד משויך לגן ונסו שוב.");
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
      const result = await response.json().catch(() => null);
      setMessage(response.ok ? "סטטוס בגדים עודכן." : result?.error || "לא ניתן לעדכן בגדים כרגע.");
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
      const result = await response.json().catch(() => null);
      setMessage(response.ok ? "נוכחות עודכנה." : result?.error || "לא ניתן לעדכן נוכחות כרגע.");
    });
  }

  return (
    <div className="quick-child-ops" aria-label="פעולות מהירות לילד">
      <button type="button" disabled={pending} onClick={() => saveAttendance("present")}><CheckCircle2 size={14} /> הגיע</button>
      <button type="button" disabled={pending} onClick={() => saveAttendance("absent")}>נעדר</button>
      {journalChips.map((chip) => <button type="button" disabled={pending} onClick={() => saveJournal(chip.field, chip.value)} key={chip.label}><chip.icon size={14} /> {chip.label}</button>)}
      <button type="button" disabled={pending} onClick={() => saveClothes(true)}><Shirt size={14} /> חסר בגדים</button>
      <Link href={`/dashboard/garden/messages?childId=${childId}`}><MessageCircle size={14} /> פנייה להורה</Link>
      <Link href={`/dashboard/garden/incidents?childId=${childId}`}><AlertTriangle size={14} /> אירוע חדש</Link>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
