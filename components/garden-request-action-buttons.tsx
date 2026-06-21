"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, FileCheck2, FileText, Phone, UserRoundCheck, XCircle } from "lucide-react";

type Tone = "purple" | "orange" | "green" | "red";

function ActionButton({
  endpoint,
  action,
  label,
  tone,
  icon: Icon,
  decisionReason
}: {
  endpoint: string;
  action: string;
  label: string;
  tone: Tone;
  icon: LucideIcon;
  decisionReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pressed, setPressed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setPressed(true);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, decision_reason: decisionReason })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error ?? "הפעולה לא הושלמה");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "הפעולה לא הושלמה");
      } finally {
        window.setTimeout(() => setPressed(false), 260);
      }
    });
  }

  return (
    <span className="teacher-live-action-wrap">
      <button
        className={`teacher-soft-button ${tone} ${pressed || pending ? "is-pressed" : ""}`}
        disabled={pending}
        type="button"
        onClick={submit}
      >
        <Icon size={18} /> {pending ? "מבצע..." : label}
      </button>
      {error ? <small className="teacher-action-error">{error}</small> : null}
    </span>
  );
}

export function EnrollmentRequestActionButtons({ requestId }: { requestId: string }) {
  const endpoint = `/api/garden/enrollment-requests/${requestId}`;
  return (
    <div className="teacher-request-actions">
      <ActionButton endpoint={endpoint} action="approve_pending_payment" label="אשר המשך טיפול" tone="purple" icon={CheckCircle2} decisionReason="הבקשה אושרה וממתינה להשלמת תשלום/פרטים." />
      <ActionButton endpoint={endpoint} action="request_more_information" label="בקשת פרטים נוספים" tone="orange" icon={FileText} decisionReason="נדרשים פרטים נוספים לפני אישור." />
      <a className="teacher-soft-button green" href="/dashboard/garden/messages"><Phone size={18} /> צור קשר</a>
      <ActionButton endpoint={endpoint} action="reject" label="דחה" tone="red" icon={XCircle} decisionReason="הבקשה נדחתה על ידי הגן." />
    </div>
  );
}

export function StaffApplicationActionButtons({ applicationId }: { applicationId: string }) {
  const endpoint = `/api/garden/staff-applications/${applicationId}`;
  return (
    <div className="teacher-request-actions">
      <ActionButton endpoint={endpoint} action="approve" label="אישור מועמד/ת" tone="purple" icon={UserRoundCheck} decisionReason="המועמדות אושרה על ידי מנהלת הגן." />
      <ActionButton endpoint={endpoint} action="request_more_information" label="בקשת מסמכים" tone="orange" icon={FileCheck2} decisionReason="נדרשים מסמכים נוספים להשלמת המועמדות." />
    </div>
  );
}
