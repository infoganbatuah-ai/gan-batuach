"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";

export function GardenAttendanceActionButton({
  childId,
  currentStatus,
  disabled
}: {
  childId: string;
  currentStatus: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const isCheckedIn = currentStatus === "present";
  if (isCheckedIn) return <Link className="ganenet-attendance-action" href="/dashboard/garden/pickup"><LogOut size={18} /> שחרור באישור איסוף</Link>;

  async function submit(action: "check_in" | "mark_absent" | "correct_to_present", reason?: string) {
    if (disabled || isPending || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/garden/attendance-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: childId, action, reason })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setMessage(payload?.error ?? "לא ניתן לעדכן נוכחות כרגע");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setMessage("לא ניתן להתחבר כרגע. בדקו את מצב הנוכחות לפני ניסיון חוזר.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function correctAbsence() {
    const reason = window.prompt("סיבת תיקון הנוכחות (לפחות 10 תווים):")?.trim();
    if (!reason || reason.length < 10) return;
    void submit("correct_to_present", reason);
  }

  return (
    <span className="ganenet-attendance-action-wrap">
      <button
        className="ganenet-attendance-action"
        type="button"
        disabled={disabled || isPending || busy}
        onClick={currentStatus === "absent" ? correctAbsence : () => submit("check_in")}
      >
        <LogIn size={18} />
        {isPending || busy ? "שומר..." : currentStatus === "absent" ? "תיקון היעדרות" : "צ׳ק אין"}
      </button>
      {currentStatus === "not_updated" ? <button className="ganenet-attendance-action" type="button" disabled={disabled || isPending || busy} onClick={() => submit("mark_absent")}>סימון היעדרות</button> : null}
      {message ? <small className="ganenet-inline-error" role="alert">{message}</small> : null}
    </span>
  );
}
