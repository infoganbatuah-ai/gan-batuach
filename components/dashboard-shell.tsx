import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import type { UserRole } from "@/lib/roles";
import { PasskeyEnrollmentPrompt } from "@/components/passkey-enrollment-prompt";
import { LogoutButton } from "@/components/logout-button";
import { PolicyAcceptanceGate } from "@/components/policy-acceptance-gate";
import { AdminGlobalSearch } from "@/components/admin-global-search";
import { RoleOnboardingGuide } from "@/components/role-onboarding-guide";
import { SandboxModeBanner } from "@/components/sandbox-mode-banner";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { OnboardingGuideControls } from "@/components/onboarding-guide-controls";
import { DashboardBackButton } from "@/components/dashboard-back-button";
import { NotificationBell } from "@/components/notification-bell";
import { PilotFeedbackWidget } from "@/components/pilot-feedback-widget";
import { FloatingActionCenter } from "@/components/floating-action-center";

const navByRole: Record<UserRole, Array<{ href: string; label: string; hint: string }>> = {
  admin: [
    { href: "/dashboard/admin", label: "מרכז שליטה", hint: "סיכונים, ערים, לידים" },
    { href: "/dashboard/admin/analytics-center", label: "מרכז אנליטיקה", hint: "מגמות והשוואות" },
    { href: "/dashboard/admin/leads", label: "לידים", hint: "המרות גנים ומפקחים" },
    { href: "/dashboard/admin/users", label: "הוספת משתמשים", hint: "גנים ופקחים" },
    { href: "/dashboard/admin/kindergartens", label: "גנים", hint: "פרופילים וסטטוס" },
    { href: "/dashboard/admin/inspectors", label: "מפקחים", hint: "ערים ושיוך" },
    { href: "/dashboard/admin/inspection-forms", label: "טפסי פיקוח", hint: "בונה דינמי" },
    { href: "/dashboard/admin/procedures", label: "נהלים", hint: "חובה ותאימות" },
    { href: "/dashboard/admin/policies", label: "תקנונים", hint: "אישורי משתמשים" },
    { href: "/dashboard/admin/cameras", label: "מצלמות", hint: "חיבורים והרשאות" },
    { href: "/dashboard/admin/camera-deployment", label: "פריסת מצלמות", hint: "חיבור שידור וניסיון ביתי" },
    { href: "/dashboard/admin/camera-infrastructure", label: "תשתית מצלמות", hint: "בריאות ואחסון" },
    { href: "/dashboard/admin/video-gateway", label: "שרת וידאו", hint: "חיבור שידורים" },
    { href: "/dashboard/admin/camera-audit", label: "בדיקת מצלמות", hint: "מוכנות שידור" },
    { href: "/dashboard/admin/ai-events", label: "אירועי תצפיתן", hint: "אירועים לבדיקה" },
    { href: "/dashboard/admin/vision-ai", label: "זיהוי חזותי", hint: "בדיקה וכיול" },
    { href: "/dashboard/admin/audio-events", label: "אינדיקציות שמע", hint: "שמע לבדיקה" },
    { href: "/dashboard/admin/correlated-events", label: "צירי זמן", hint: "אירועים מקושרים" },
    { href: "/dashboard/admin/observer-intelligence", label: "סיכומי תצפיתן", hint: "מה לבדוק" },
    { href: "/dashboard/admin/observer-test-center", label: "בדיקות תצפיתן", hint: "בדיקה שקטה וכיול" },
    { href: "/dashboard/admin/observer-calibration", label: "כיול תצפיתן", hint: "דיוק ובשלות" },
    { href: "/dashboard/admin/risk-intelligence", label: "מודיעין סיכון", hint: "חיזוי ומניעה" },
    { href: "/dashboard/admin/predictive-safety", label: "בטיחות חזויה", hint: "מניעה מוקדמת" },
    { href: "/dashboard/admin/observer-replay", label: "סקירת תצפיתן", hint: "בדיקת אירועים" },
    { href: "/dashboard/admin/observer-learning", label: "למידת תצפיתן", hint: "אזורים ושגרות" },
    { href: "/dashboard/admin/observer-learning-advanced", label: "למידה מתקדמת", hint: "שגרה ומוכנות" },
    { href: "/dashboard/admin/observer-watch", label: "בקשות מעקב", hint: "מה לבדוק" },
    { href: "/dashboard/admin/observer-platform", label: "פלטפורמת תצפיתן", hint: "מוצר עתידי" },
    { href: "/dashboard/admin/observer-packages", label: "חבילות תצפיתן", hint: "מוצר עתידי" },
    { href: "/dashboard/admin/observer-billing", label: "חיוב תצפיתן", hint: "מוצר עתידי" },
    { href: "/dashboard/admin/notifications", label: "התראות", hint: "מרכז פעולות" },
    { href: "/dashboard/admin/integrations", label: "אינטגרציות", hint: "הפעלת ייצור" },
    { href: "/dashboard/admin/communications", label: "ערוצי תקשורת", hint: "הודעות, מייל ונייד" },
    { href: "/dashboard/admin/communication", label: "לוג תקשורת", hint: "הודעות ותבניות" },
    { href: "/dashboard/admin/sms", label: "מסרונים", hint: "בדיקות ושליחה" },
    { href: "/dashboard/admin/whatsapp", label: "WhatsApp", hint: "תבניות ומסירה" },
    { href: "/dashboard/admin/push", label: "התראות לנייד", hint: "מכשירים ואפליקציה" },
    { href: "/dashboard/admin/push-production", label: "התראות פעילות", hint: "בדיקות ושליחה" },
    { href: "/dashboard/admin/email-production", label: "מיילים פעילים", hint: "תבניות ושליחה" },
    { href: "/dashboard/admin/subscriptions", label: "מנויים", hint: "חיוב ותוכניות" },
    { href: "/dashboard/admin/tasks", label: "משימות", hint: "מעקב והסלמה" },
    { href: "/dashboard/admin/complaints", label: "דיווחים ופניות", hint: "זמן טיפול ודחיפות" },
    { href: "/dashboard/admin/incident-center", label: "תיקי אירוע", hint: "חקירה וראיות" },
    { href: "/dashboard/admin/documents", label: "מסמכים", hint: "תוקף וציות" },
    { href: "/dashboard/admin/security-center", label: "מרכז אבטחה", hint: "בדיקה חיצונית" },
    { href: "/dashboard/admin/security", label: "אבטחה", hint: "מוכנות ייצור" },
    { href: "/dashboard/admin/system-health", label: "בריאות מערכת", hint: "מה חסר" },
    { href: "/dashboard/admin/navigation-health", label: "בריאות ניווט", hint: "בדיקת routes" },
    { href: "/dashboard/admin/mobile-audit", label: "בדיקת מובייל", hint: "חוויית טלפון" },
    { href: "/dashboard/admin/pilot-center", label: "מרכז פיילוט", hint: "לקוחות ראשונים" },
    { href: "/dashboard/admin/pilot-health", label: "בריאות פיילוט", hint: "גן ראשון" },
    { href: "/dashboard/admin/launch-readiness", label: "מוכנות השקה", hint: "עלייה לאוויר" },
    { href: "/dashboard/admin/pilot-readiness", label: "מוכנות פיילוט", hint: "משוב וחסמים" },
    { href: "/dashboard/admin/duplicates", label: "כפילויות", hint: "תעודות זהות" },
    { href: "/dashboard/admin/user-journey-audit", label: "בדיקת מסעות", hint: "זרימות משתמש" },
    { href: "/dashboard/admin/smart-engine-audit", label: "בדיקת תובנות", hint: "מנוע המלצות" },
    { href: "/dashboard/admin/audit-logs", label: "יומן פעולות", hint: "מעקב מערכת" },
    { href: "/dashboard/admin/demo-control", label: "נתוני ניסיון", hint: "בדיקות בטוחות" },
    { href: "/dashboard/admin/qa-checklist", label: "רשימת בדיקה", hint: "בדיקות תפעול" },
    { href: "/dashboard/admin/simplicity-audit", label: "בדיקת פשטות", hint: "פשטות שימוש" },
    { href: "/dashboard/admin/reports", label: "דוחות", hint: "ייצוא וניתוח" },
    { href: "/dashboard/admin/settings", label: "הגדרות", hint: "מערכת והרשאות" }
  ],  inspector: [
    { href: "/dashboard/inspector/command-center", label: "מרכז שטח", hint: "פיקוח היום" },
    { href: "/dashboard/inspector", label: "ביקורות", hint: "חודשי, GPS, ליקויים" },
    { href: "/dashboard/inspector/inspections", label: "ביקורות", hint: "נתוני פיקוח" },
    { href: "/dashboard/inspector/cameras", label: "מצלמות", hint: "גנים משויכים" },
    { href: "/dashboard/inspector/ai-events", label: "תצפיתן", hint: "אירועים לבדיקה" },
    { href: "/dashboard/inspector/risk", label: "מודיעין סיכון", hint: "תיעדוף מונע" },
    { href: "/dashboard/inspector/reports", label: "דיווחים", hint: "פניות ואירועים" },
    { href: "/dashboard/inspector/notifications", label: "התראות", hint: "פיקוח ומשימות" },
    { href: "/dashboard/inspector/tasks", label: "משימות", hint: "לביצוע" },
    { href: "/dashboard/inspector/violations", label: "ליקויים", hint: "אישור תיקונים" },
    { href: "/dashboard/inspector/settings", label: "הגדרות", hint: "פרופיל והתראות" }
  ],
  manager: [
    { href: "/dashboard/garden", label: "ניהול גן", hint: "יום עבודה" },
    { href: "/dashboard/garden/command-center", label: "מרכז פיקוד", hint: "ניהול הגן עכשיו" },
    { href: "/dashboard/garden/operations", label: "מערכת הפעלה", hint: "כל הגן במקום אחד" },
    { href: "/dashboard/garden/child-journal", label: "יומן ילד", hint: "עדכוני הורים" },
    { href: "/dashboard/garden/health", label: "בריאות", hint: "אלרגיות ותרופות" },
    { href: "/dashboard/garden/pickup", label: "איסוף", hint: "GPS ומורשים" },
    { href: "/dashboard/garden/pickup-face", label: "בדיקת איסוף", hint: "איסוף בטוח" },
    { href: "/dashboard/garden/incidents", label: "אירועים", hint: "דיווח וטיפול" },
    { href: "/dashboard/garden/daily-journal", label: "יומן תפעול", hint: "צ׳קליסט יומי" },
    { href: "/dashboard/garden/cameras", label: "מצלמות", hint: "אשף חיבור" },
    { href: "/dashboard/garden/camera-health", label: "בריאות מצלמות", hint: "חיבור ואחסון" },
    { href: "/dashboard/garden/ai-events", label: "אירועי תצפיתן", hint: "בדיקה אנושית" },
    { href: "/dashboard/garden/vision-ai", label: "זיהוי חזותי", hint: "לאחר בדיקה אנושית" },
    { href: "/dashboard/garden/audio-events", label: "אינדיקציות שמע", hint: "בדיקה אנושית" },
    { href: "/dashboard/garden/correlated-events", label: "צירי זמן", hint: "אירועים מקושרים" },
    { href: "/dashboard/garden/observer-intelligence", label: "מה לבדוק", hint: "סיכומי תצפיתן" },
    { href: "/dashboard/garden/risk", label: "סיכון ומניעה", hint: "המלצות רגועות" },
    { href: "/dashboard/garden/onboarding", label: "קליטה", hint: "הורים, ילדים וצוות" },
    { href: "/dashboard/garden/leads", label: "לידים / בקשות הצטרפות", hint: "רישום הורים" },
    { href: "/dashboard/garden/notifications", label: "התראות", hint: "מה דורש טיפול" },
    { href: "/dashboard/garden/communication", label: "תקשורת", hint: "מסרונים והודעות" },
    { href: "/dashboard/garden/insights", label: "תובנות חכמות", hint: "מה דורש טיפול" },
    { href: "/dashboard/garden/observer-learning", label: "למידת תצפיתן", hint: "אזורים ושגרה" },
    { href: "/dashboard/garden/observer-watch", label: "בקשות מעקב", hint: "מה לבדוק" },
    { href: "/dashboard/garden/children", label: "ילדים", hint: "רישום ואישור" },
    { href: "/dashboard/garden/finance", label: "כספים", hint: "גבייה ותשלומים" },
    { href: "/dashboard/garden/subscription", label: "מנוי", hint: "תוכנית וחידוש" },
    { href: "/dashboard/garden/parents", label: "הורים", hint: "אנשי קשר" },
    { href: "/dashboard/garden/staff", label: "צוות", hint: "אישורים ותעודות" },
    { href: "/dashboard/garden/tasks", label: "משימות", hint: "לביצוע ואישור" },
    { href: "/dashboard/garden/documents", label: "מסמכים", hint: "תוקף ואישור" },
    { href: "/dashboard/garden/inspections", label: "פיקוח", hint: "דוחות ותיקונים" },
    { href: "/dashboard/garden/attendance", label: "נוכחות", hint: "ילדים וצוות" },
    { href: "/dashboard/garden/settings", label: "הגדרות", hint: "פרופיל ולוגו" }
  ],
  owner: [
    { href: "/dashboard/garden", label: "ניהול גן", hint: "יום עבודה" },
    { href: "/dashboard/garden/command-center", label: "מרכז פיקוד", hint: "ניהול הגן עכשיו" },
    { href: "/dashboard/garden/operations", label: "מערכת הפעלה", hint: "כל הגן במקום אחד" },
    { href: "/dashboard/garden/child-journal", label: "יומן ילד", hint: "עדכוני הורים" },
    { href: "/dashboard/garden/health", label: "בריאות", hint: "אלרגיות ותרופות" },
    { href: "/dashboard/garden/pickup", label: "איסוף", hint: "GPS ומורשים" },
    { href: "/dashboard/garden/pickup-face", label: "בדיקת איסוף", hint: "איסוף בטוח" },
    { href: "/dashboard/garden/incidents", label: "אירועים", hint: "דיווח וטיפול" },
    { href: "/dashboard/garden/daily-journal", label: "יומן תפעול", hint: "צ׳קליסט יומי" },
    { href: "/dashboard/garden/cameras", label: "מצלמות", hint: "אשף חיבור" },
    { href: "/dashboard/garden/camera-health", label: "בריאות מצלמות", hint: "חיבור ואחסון" },
    { href: "/dashboard/garden/ai-events", label: "אירועי תצפיתן", hint: "בדיקה אנושית" },
    { href: "/dashboard/garden/vision-ai", label: "זיהוי חזותי", hint: "לאחר בדיקה אנושית" },
    { href: "/dashboard/garden/audio-events", label: "אינדיקציות שמע", hint: "בדיקה אנושית" },
    { href: "/dashboard/garden/correlated-events", label: "צירי זמן", hint: "אירועים מקושרים" },
    { href: "/dashboard/garden/observer-intelligence", label: "מה לבדוק", hint: "סיכומי תצפיתן" },
    { href: "/dashboard/garden/risk", label: "סיכון ומניעה", hint: "המלצות רגועות" },
    { href: "/dashboard/garden/onboarding", label: "קליטה", hint: "הורים, ילדים וצוות" },
    { href: "/dashboard/garden/leads", label: "לידים / בקשות הצטרפות", hint: "רישום הורים" },
    { href: "/dashboard/garden/notifications", label: "התראות", hint: "מה דורש טיפול" },
    { href: "/dashboard/garden/communication", label: "תקשורת", hint: "מסרונים והודעות" },
    { href: "/dashboard/garden/insights", label: "תובנות חכמות", hint: "מה דורש טיפול" },
    { href: "/dashboard/garden/observer-learning", label: "למידת תצפיתן", hint: "אזורים ושגרה" },
    { href: "/dashboard/garden/observer-watch", label: "בקשות מעקב", hint: "מה לבדוק" },
    { href: "/dashboard/garden/children", label: "ילדים", hint: "רישום ואישור" },
    { href: "/dashboard/garden/finance", label: "כספים", hint: "גבייה ותשלומים" },
    { href: "/dashboard/garden/subscription", label: "מנוי", hint: "תוכנית וחידוש" },
    { href: "/dashboard/garden/parents", label: "הורים", hint: "אנשי קשר" },
    { href: "/dashboard/garden/staff", label: "צוות", hint: "אישורים ותעודות" },
    { href: "/dashboard/garden/tasks", label: "משימות", hint: "לביצוע ואישור" },
    { href: "/dashboard/garden/documents", label: "מסמכים", hint: "תוקף ואישור" },
    { href: "/dashboard/garden/inspections", label: "פיקוח", hint: "דוחות ותיקונים" },
    { href: "/dashboard/garden/attendance", label: "נוכחות", hint: "ילדים וצוות" },
    { href: "/dashboard/garden/settings", label: "הגדרות", hint: "פרופיל ולוגו" }
  ],
  staff: [
    { href: "/dashboard/staff", label: "צוות", hint: "מיקום ומשימות" },
    { href: "/dashboard/staff/operations", label: "תפעול משמרת", hint: "הכל במסך אחד" },
    { href: "/dashboard/staff/attendance", label: "נוכחות", hint: "כניסה/יציאה" },
    { href: "/dashboard/staff/child-journal", label: "יומן ילד", hint: "עדכוני הורים" },
    { href: "/dashboard/staff/incidents", label: "אירועים", hint: "דיווח מהיר" },
    { href: "/dashboard/staff/daily-journal", label: "יומן תפעול", hint: "צ׳קליסט" },
    { href: "/dashboard/staff/cameras", label: "מצלמות", hint: "צפייה מורשית" },
    { href: "/dashboard/staff/tasks", label: "משימות", hint: "לביצוע" },
    { href: "/dashboard/staff/documents", label: "מסמכים", hint: "תעודות ואישורים" },
    { href: "/dashboard/staff/shifts", label: "שעות", hint: "דוחות חודשיים" },
    { href: "/dashboard/staff/messages", label: "הודעות", hint: "תקשורת" },
    { href: "/dashboard/staff/notifications", label: "התראות", hint: "מה חדש" },
    { href: "/dashboard/staff/settings", label: "הגדרות", hint: "פרופיל והתראות" }
  ],
  parent: [
    { href: "/dashboard/parent/family-home", label: "בית משפחתי", hint: "היום של הילד" },
    { href: "/dashboard/parent", label: "אזור הורים", hint: "ילד וגן" },
    { href: "/dashboard/parent/trust", label: "מרכז אמון", hint: "שקיפות ובטיחות" },
    { href: "/dashboard/parent/cameras", label: "מצלמות הגן", hint: "צפייה מורשית" },
    { href: "/dashboard/parent/ai-events", label: "עדכוני בטיחות", hint: "רק לאחר אישור" },
    { href: "/dashboard/parent/daily-journal", label: "יומן יומי", hint: "עדכוני הילד" },
    { href: "/dashboard/parent/pickup", label: "איסוף", hint: "מורשים וזמני" },
    { href: "/dashboard/parent/notifications", label: "התראות", hint: "עדכונים חשובים" },
    { href: "/dashboard/parent/messages", label: "הודעות", hint: "שיחה עם הגן" },
    { href: "/dashboard/parent/gallery", label: "גלריה", hint: "רגעים מהגן" },
    { href: "/parent-onboarding", label: "כרטיס ילד", hint: "פרטים והסכמות" },
    { href: "/dashboard/parent/documents", label: "מסמכים", hint: "אישורים וקבצים" },
    { href: "/dashboard/parent/payments", label: "תשלומים", hint: "יתרה ותאריך הבא" },
    { href: "/dashboard/parent/inspections", label: "פיקוח", hint: "סיכום מאושר" },
    { href: "/dashboard/parent/complaints", label: "תלונות", hint: "פנייה מסודרת" },
    { href: "/dashboard/parent/settings", label: "הגדרות", hint: "פרופיל והתראות" }
  ]
};

const dashboardHomeByRole: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  inspector: "/dashboard/inspector/command-center",
  manager: "/dashboard/garden/command-center",
  owner: "/dashboard/garden/command-center",
  staff: "/dashboard/staff/operations",
  parent: "/dashboard/parent/family-home"
};

const mobileNavByRole: Record<UserRole, Array<{ href: string; label: string; hint: string }>> = {
  admin: [
    { href: "/dashboard/admin", label: "בית", hint: "שליטה" },
    { href: "/dashboard/admin/kindergartens", label: "גנים", hint: "ניהול" },
    { href: "/dashboard/admin/users", label: "משתמשים", hint: "ניהול" },
    { href: "/dashboard/admin/notifications", label: "התראות", hint: "חשוב" },
    { href: "/dashboard/admin/settings", label: "עוד", hint: "מתקדם" }
  ],
  manager: [
    { href: "/dashboard/garden/command-center", label: "בית", hint: "היום" },
    { href: "/dashboard/garden/children", label: "ילדים", hint: "עדכון" },
    { href: "/dashboard/garden/messages", label: "פניות", hint: "הורים" },
    { href: "/dashboard/garden/cameras", label: "מצלמות", hint: "צפייה" },
    { href: "/dashboard/garden/tasks", label: "משימות", hint: "היום" }
  ],
  owner: [
    { href: "/dashboard/garden/command-center", label: "בית", hint: "היום" },
    { href: "/dashboard/garden/children", label: "ילדים", hint: "עדכון" },
    { href: "/dashboard/garden/messages", label: "פניות", hint: "הורים" },
    { href: "/dashboard/garden/cameras", label: "מצלמות", hint: "צפייה" },
    { href: "/dashboard/garden/tasks", label: "משימות", hint: "היום" }
  ],
  staff: [
    { href: "/dashboard/staff/operations", label: "בית", hint: "משמרת" },
    { href: "/dashboard/staff/child-journal", label: "ילדים", hint: "עדכון" },
    { href: "/dashboard/staff/messages", label: "הודעות", hint: "גן" },
    { href: "/dashboard/staff/tasks", label: "משימות", hint: "היום" },
    { href: "/dashboard/staff/notifications", label: "עוד", hint: "עוד" }
  ],
  inspector: [
    { href: "/dashboard/inspector/command-center", label: "בית", hint: "שטח" },
    { href: "/dashboard/inspector/inspections", label: "ביקורות", hint: "היום" },
    { href: "/dashboard/inspector/reports", label: "דוחות", hint: "סיכום" },
    { href: "/dashboard/inspector/violations", label: "חריגות", hint: "טיפול" },
    { href: "/dashboard/inspector/notifications", label: "עוד", hint: "עוד" }
  ],
  parent: [
    { href: "/dashboard/parent/family-home", label: "בית", hint: "משפחה" },
    { href: "/dashboard/parent/daily-journal", label: "ילדים", hint: "יומן" },
    { href: "/dashboard/parent/messages", label: "הודעות", hint: "גן" },
    { href: "/dashboard/parent/cameras", label: "מצלמות", hint: "צפייה" },
    { href: "/dashboard/parent/notifications", label: "עוד", hint: "התראות" }
  ]
};

function navGroupFor(role: UserRole, href: string) {
  if (role === "admin") {
    if (href === "/dashboard/admin" || href.includes("/analytics-center") || href.includes("/system-health") || href.includes("/pilot") || href.includes("/launch-readiness")) return "תפעול";
    if (href.includes("/kindergartens") || href.includes("/gardens") || href.includes("/leads")) return "גנים";
    if (href.includes("/users") || href.includes("/inspectors")) return "צוות";
    if (href.includes("/subscriptions")) return "כספים";
    if (href.includes("/communication") || href.includes("/communications") || href.includes("/sms") || href.includes("/whatsapp") || href.includes("/push") || href.includes("/email") || href.includes("/notifications")) return "תקשורת";
    if (href.includes("camera") || href.includes("video-gateway")) return "מצלמות";
    if (href.includes("observer") || href.includes("risk") || href.includes("ai") || href.includes("vision") || href.includes("audio") || href.includes("correlated")) return "חכם";
    if (href.includes("inspection") || href.includes("incident") || href.includes("violations") || href.includes("complaints")) return "בטיחות";
    if (href.includes("documents") || href.includes("policies") || href.includes("procedures") || href.includes("security")) return "ציות";
    if (href.includes("reports") || href.includes("audit") || href.includes("qa") || href.includes("journey") || href.includes("navigation") || href.includes("mobile") || href.includes("duplicates") || href.includes("simplicity") || href.includes("smart-engine")) return "דוחות";
    return "הגדרות";
  }
  if (role === "manager" || role === "owner") {
    if (href === "/dashboard/garden" || href.includes("/command-center") || href.includes("/operations") || href.includes("/attendance") || href.includes("/daily-journal") || href.includes("/insights")) return "תפעול";
    if (href.includes("/children") || href.includes("/child-journal") || href.includes("/health") || href.includes("/pickup") || href.includes("/incidents") || href.includes("/daily-journal")) return "ילדים";
    if (href.includes("/parents") || href.includes("/leads") || href.includes("/onboarding")) return "הורים";
    if (href.includes("/staff") || href.includes("/tasks")) return "צוות";
    if (href.includes("/finance") || href.includes("/subscription")) return "כספים";
    if (href.includes("/communication") || href.includes("/messages") || href.includes("/notifications")) return "תקשורת";
    if (href.includes("/cameras") || href.includes("/camera-health")) return "מצלמות";
    if (href.includes("observer") || href.includes("/risk") || href.includes("ai-events") || href.includes("audio-events") || href.includes("correlated") || href.includes("vision-ai")) return "חכם";
    if (href.includes("/inspections") || href.includes("/documents")) return "ציות";
    return "הגדרות";
  }
  if (role === "parent") {
    if (href === "/dashboard/parent" || href.includes("/family-home") || href.includes("/daily-journal") || href.includes("/children") || href.includes("/gallery")) return "ילדים";
    if (href.includes("/messages") || href.includes("/notifications")) return "תקשורת";
    if (href.includes("/cameras")) return "מצלמות";
    if (href.includes("/pickup") || href.includes("/documents") || href.includes("/payments")) return "תפעול";
    if (href.includes("/trust") || href.includes("/inspections") || href.includes("/ai-events") || href.includes("/complaints")) return "בטיחות";
    return "הגדרות";
  }
  if (role === "staff") {
    if (href === "/dashboard/staff" || href.includes("/operations") || href.includes("/attendance") || href.includes("/tasks") || href.includes("/daily-journal")) return "תפעול";
    if (href.includes("/child-journal") || href.includes("/incidents")) return "ילדים";
    if (href.includes("/messages") || href.includes("/notifications")) return "תקשורת";
    if (href.includes("/cameras")) return "מצלמות";
    if (href.includes("/documents") || href.includes("/certificates") || href.includes("/shifts") || href.includes("/background")) return "צוות";
    return "הגדרות";
  }
  if (href === "/dashboard/inspector" || href.includes("/command-center") || href.includes("/tasks") || href.includes("/notifications")) return "תפעול";
  if (href.includes("/inspections") || href.includes("/violations") || href.includes("/compliance")) return "ציות";
  if (href.includes("/cameras")) return "מצלמות";
  if (href.includes("/ai-events") || href.includes("/risk") || href.includes("/observer")) return "חכם";
  if (href.includes("/reports") || href.includes("/ratings")) return "דוחות";
  return "הגדרות";
}

function groupedNav(role: UserRole) {
  const groups = new Map<string, Array<{ href: string; label: string; hint: string }>>();
  for (const item of navByRole[role]) {
    const group = navGroupFor(role, item.href);
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  return Array.from(groups.entries());
}

export function DashboardShell({ role, title, children }: { role: UserRole; title: string; children: React.ReactNode }) {
  const mobileNav = mobileNavByRole[role];
  const navGroups = groupedNav(role);
  return (
    <>
      <BrandHeader />
      <div className={`dashboard-layout dashboard-role-${role}`}>
        <aside className="sidebar">
          <div className="sidebar-topline">
            <div>
              <span className="sidebar-kicker">Gan Batuach</span>
              <h2>{title}</h2>
            </div>
            <LogoutButton />
          </div>
          <p>כל מה שחשוב לתפקיד שלך, מסודר לפי פעולה.</p>
          <nav>
            {navGroups.map(([group, items], index) => (
              <details className="nav-group" key={group} open={index < 2}>
                <summary>{group}</summary>
                <div>
                  {items.map((item) => (
                    <Link href={item.href} key={item.href}>
                      <strong>{item.label}</strong>
                      <span>{item.hint}</span>
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </nav>
          <PasskeyEnrollmentPrompt />
        </aside>
        <main className="dashboard-main">
          <div className="dashboard-page-navigation">
            <DashboardBackButton fallbackHref={dashboardHomeByRole[role]} />
            <NotificationBell role={role} />
          </div>
          <PolicyAcceptanceGate />
          <SandboxModeBanner />
          <OnboardingGuideControls role={role} />
          <RoleOnboardingGuide role={role} />
          {role === "admin" ? <AdminGlobalSearch /> : null}
          {children}
          <AIAssistantPanel role={role} />
          <PilotFeedbackWidget role={role} />
        </main>
        <nav className="mobile-tabbar" aria-label="ניווט דשבורד">{mobileNav.map((item) => <Link href={item.href} key={item.href}><strong>{item.label}</strong><span>{item.hint}</span></Link>)}</nav>
        <FloatingActionCenter role={role} />
      </div>
    </>
  );
}
