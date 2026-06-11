import type { UserRole } from "@/lib/roles";
import type { SmartInsight } from "@/lib/domain/smart-kindergarten-engine";

export type AssistantPermissionMode =
  | "admin_global"
  | "garden_scoped"
  | "parent_child_scoped"
  | "staff_scoped"
  | "inspector_assignment_scoped";

export function assistantPermissionMode(role: UserRole): AssistantPermissionMode {
  if (role === "admin") return "admin_global";
  if (role === "parent") return "parent_child_scoped";
  if (role === "staff") return "staff_scoped";
  if (role === "inspector") return "inspector_assignment_scoped";
  return "garden_scoped";
}

export function assistantPermissionSummary(role: UserRole) {
  if (role === "parent") return "התשובות מבוססות רק על ילדים, מסמכים, הודעות וצירי זמן שמאושרים להורה הזה.";
  if (role === "staff") return "התשובות מוגבלות למשמרת, משימות ונתוני גן שמותרים לאיש הצוות.";
  if (role === "inspector") return "התשובות מוגבלות לגנים, ביקורות, תלונות וליקויים שמוקצים לפקח.";
  if (role === "admin") return "התשובות מציגות מבט מערכתי לאדמין, ללא ביצוע פעולות אוטומטיות.";
  return "התשובות מוגבלות לגן המשויך ולפעולות התפעוליות של המנהלת או הבעלים.";
}

export function assistantContextSources(role: UserRole) {
  if (role === "parent") return ["ציר ילד מאושר", "יומן יומי", "מסמכים", "הודעות", "מצלמות מאושרות", "תשלומים"];
  if (role === "staff") return ["משימות", "יומן ילד", "התראות", "מסמכי צוות", "משמרת"];
  if (role === "inspector") return ["ביקורות", "ליקויים", "תלונות", "סיכוני גנים", "מצלמות פיקוח"];
  if (role === "admin") return ["גנים", "פיקוח", "אירועים", "ציות", "תצפיתן", "מצלמות", "מנויים", "תקשורת"];
  return ["נוכחות", "ילדים", "צוות", "מסמכים", "אירועים", "כספים", "מצלמות", "פיקוח", "פניות הורים"];
}

export function assistantDailyBriefing(role: UserRole, insights: SmartInsight[]) {
  const urgent = insights.filter((item) => item.severity === "critical" || item.severity === "urgent");
  const warning = insights.filter((item) => item.severity === "warning");
  if (role === "parent") {
    if (urgent.length || warning.length) return "יש כמה עדכונים שכדאי לפתוח היום, בעיקר מסמכים, תשלומים או הודעות מהגן.";
    return "היום נראה רגוע. עדכוני הילד והגן יופיעו כאן כשהם יאושרו לשיתוף.";
  }
  if (role === "staff") {
    if (urgent.length || warning.length) return "כדאי להתחיל ממשימות פתוחות, עדכוני ילדים ומסמכים שחסרים לך.";
    return "המשמרת נראית מסודרת כרגע. המשיכי לעדכן ילדים ומשימות לפי הצורך.";
  }
  if (role === "inspector") {
    if (urgent.length) return "יש ביקורות, ליקויים או מצלמות שדורשים תשומת לב היום.";
    if (warning.length) return "יש נושאי פיקוח שכדאי לבדוק לפני סוף היום.";
    return "אין כרגע פיקוח דחוף לפי הנתונים הזמינים.";
  }
  if (role === "admin") {
    if (urgent.length) return "יש סיכונים מערכתיים שדורשים בדיקה: פיקוח, מצלמות, מסמכים או פניות.";
    if (warning.length) return "יש כמה אזורי מערכת שכדאי לעקוב אחריהם היום.";
    return "התמונה המערכתית רגועה לפי הנתונים הזמינים.";
  }
  if (urgent.length) return "יש נושאים תפעוליים שדורשים טיפול בגן היום.";
  if (warning.length) return "יש כמה פעולות שכדאי להשלים כדי לסגור את היום בצורה מסודרת.";
  return "הגן נראה רגוע כרגע לפי הנתונים הזמינים.";
}

export function assistantNotificationIntelligence(insights: SmartInsight[]) {
  return {
    urgent: insights.filter((item) => item.severity === "critical" || item.severity === "urgent").length,
    important: insights.filter((item) => item.severity === "warning").length,
    informational: insights.filter((item) => item.severity === "info").length
  };
}

export function normalizeAssistantQuestion(prompt: string) {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 180);
}

export function buildAssistantContextScope(profile: any) {
  return {
    role: profile.role,
    permission_mode: assistantPermissionMode(profile.role),
    profile_id: profile.id,
    garden_id: profile.garden_id ?? profile.kindergarten_id ?? null
  };
}
