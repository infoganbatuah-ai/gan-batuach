export type CanonicalStatusTone = "default" | "primary" | "success" | "warning" | "danger" | "info" | "muted";

type StatusDefinition = { label: string; tone: CanonicalStatusTone };

const statusDefinitions: Record<string, StatusDefinition> = {
  active: { label: "פעיל", tone: "success" },
  approved: { label: "מאושר", tone: "success" },
  available: { label: "זמין", tone: "success" },
  blocked: { label: "חסום", tone: "danger" },
  canceled: { label: "בוטל", tone: "muted" },
  cancelled: { label: "בוטל", tone: "muted" },
  closed: { label: "סגור", tone: "success" },
  completed: { label: "הושלם", tone: "success" },
  configured: { label: "מוגדר", tone: "success" },
  connected: { label: "מחובר", tone: "success" },
  degraded: { label: "פעילות חלקית", tone: "warning" },
  disabled: { label: "מושבת", tone: "muted" },
  disconnected: { label: "מנותק", tone: "danger" },
  draft: { label: "טיוטה", tone: "muted" },
  error: { label: "שגיאה", tone: "danger" },
  escalated: { label: "הוסלם", tone: "danger" },
  expired: { label: "פג תוקף", tone: "danger" },
  failed: { label: "נכשל", tone: "danger" },
  healthy: { label: "תקין", tone: "success" },
  inactive: { label: "לא פעיל", tone: "muted" },
  in_progress: { label: "בתהליך", tone: "info" },
  information_required: { label: "נדרש מידע", tone: "warning" },
  more_evidence_required: { label: "נדרשות ראיות נוספות", tone: "warning" },
  not_configured: { label: "טרם הוגדר", tone: "muted" },
  not_verified: { label: "טרם אומת", tone: "warning" },
  offline: { label: "לא מחובר", tone: "danger" },
  online: { label: "מחובר", tone: "success" },
  open: { label: "פתוח", tone: "info" },
  overdue: { label: "באיחור", tone: "danger" },
  pending: { label: "ממתין", tone: "warning" },
  pending_approval: { label: "ממתין לאישור", tone: "warning" },
  pending_review: { label: "ממתין לבדיקה", tone: "warning" },
  permission_denied: { label: "אין הרשאה", tone: "danger" },
  production_verification_required: { label: "נדרש אימות Production", tone: "warning" },
  rejected: { label: "נדחה", tone: "danger" },
  resolved: { label: "טופל", tone: "success" },
  retrying: { label: "מנסה להתחבר מחדש", tone: "info" },
  setup_required: { label: "נדרשת הגדרה", tone: "warning" },
  stale: { label: "המידע אינו עדכני", tone: "warning" },
  submitted: { label: "הוגש", tone: "info" },
  success: { label: "הצליח", tone: "success" },
  suspended: { label: "מושהה", tone: "danger" },
  unavailable: { label: "לא זמין", tone: "muted" },
  under_review: { label: "בבדיקה", tone: "info" },
  unverified: { label: "לא מאומת", tone: "warning" },
  verified: { label: "מאומת", tone: "success" },
  waiting_for_response: { label: "ממתין לתגובה", tone: "warning" },
  awaiting_review: { label: "ממתין לבדיקה", tone: "warning" },
  action_required: { label: "נדרשת פעולה", tone: "warning" }
};

export function canonicalStatusKey(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function canonicalStatusLabel(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "מצב לא ידוע";
  return statusDefinitions[canonicalStatusKey(raw)]?.label ?? raw;
}

export function canonicalStatusTone(value?: string | null): CanonicalStatusTone {
  return statusDefinitions[canonicalStatusKey(value)]?.tone ?? "default";
}

export function canonicalStatusDefinition(value?: string | null): StatusDefinition {
  return { label: canonicalStatusLabel(value), tone: canonicalStatusTone(value) };
}
