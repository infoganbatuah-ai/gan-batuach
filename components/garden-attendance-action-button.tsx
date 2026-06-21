"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogIn, LogOut } from "lucide-react";

type AttendanceAction = "check_in" | "check_out";

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
  const [message, setMessage] = useState<string | null>(null);
  const isCheckedIn = currentStatus === "present";
  const action: AttendanceAction = isCheckedIn ? "check_out" : "check_in";

  async function submit() {
    if (disabled || isPending) return;
    setMessage(null);
    const response = await fetch("/api/garden/attendance-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ child_id: childId, action })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error ?? "לא ניתן לעדכן נוכחות כרגע");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <span className="ganenet-attendance-action-wrap">
      <button
        className="ganenet-attendance-action"
        type="button"
        disabled={disabled || isPending}
        onClick={submit}
      >
        {isCheckedIn ? <LogOut size={18} /> : <LogIn size={18} />}
        {isPending ? "שומר..." : isCheckedIn ? "צ׳ק אאוט" : "צ׳ק אין"}
      </button>
      {message ? <small className="ganenet-inline-error">{message}</small> : null}
    </span>
  );
}
