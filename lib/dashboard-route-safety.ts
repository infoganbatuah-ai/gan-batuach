import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { UserRole } from "@/lib/roles";

export type DashboardRouteCheck = {
  route: string;
  label: string;
  roles: UserRole[];
  dataTable?: string;
  requiredProfileField?: "garden_id";
};

export const dashboardRouteChecks: DashboardRouteCheck[] = [
  { route: "/dashboard/admin", label: "מרכז שליטה", roles: ["admin"], dataTable: "gardens" },
  { route: "/dashboard/admin/analytics-center", label: "מרכז אנליטיקה", roles: ["admin"], dataTable: "cross_kindergarten_analytics_snapshots" },
  { route: "/dashboard/admin/leads", label: "לידים", roles: ["admin"], dataTable: "leads" },
  { route: "/dashboard/admin/users", label: "משתמשים", roles: ["admin"], dataTable: "profiles" },
  { route: "/dashboard/admin/kindergartens", label: "גנים", roles: ["admin"], dataTable: "gardens" },
  { route: "/dashboard/admin/inspectors", label: "מפקחים", roles: ["admin"], dataTable: "inspectors" },
  { route: "/dashboard/admin/inspection-forms", label: "טפסי פיקוח", roles: ["admin"], dataTable: "inspection_forms" },
  { route: "/dashboard/admin/procedures", label: "נהלים", roles: ["admin"], dataTable: "procedures" },
  { route: "/dashboard/admin/policies", label: "תקנונים", roles: ["admin"], dataTable: "policies" },
  { route: "/dashboard/admin/cameras", label: "מצלמות", roles: ["admin"], dataTable: "camera_streams" },
  { route: "/dashboard/admin/camera-gateway", label: "Camera Gateway", roles: ["admin"], dataTable: "camera_gateway_configs" },
  { route: "/dashboard/admin/ai-events", label: "אירועי AI", roles: ["admin"], dataTable: "ai_events" },
  { route: "/dashboard/admin/notifications", label: "התראות", roles: ["admin"], dataTable: "notifications" },
  { route: "/dashboard/admin/tasks", label: "משימות", roles: ["admin"], dataTable: "tasks" },
  { route: "/dashboard/admin/complaints", label: "דיווחים ופניות", roles: ["admin"], dataTable: "complaints" },
  { route: "/dashboard/admin/incident-center", label: "תיקי אירוע", roles: ["admin"], dataTable: "incident_cases" },
  { route: "/dashboard/admin/predictive-safety", label: "בטיחות חזויה", roles: ["admin"], dataTable: "early_warning_signals" },
  { route: "/dashboard/admin/document-center", label: "מרכז מסמכים", roles: ["admin"], dataTable: "documents" },
  { route: "/dashboard/admin/documents", label: "מסמכים", roles: ["admin"], dataTable: "documents" },
  { route: "/dashboard/admin/integrations", label: "אינטגרציות", roles: ["admin"], dataTable: "production_integrations" },
  { route: "/dashboard/admin/database-integrity", label: "שלמות DB", roles: ["admin"], dataTable: "database_integrity_audit_items" },
  { route: "/dashboard/admin/iso-evidence", label: "ראיות ISO", roles: ["admin"], dataTable: "iso_evidence_items" },
  { route: "/dashboard/admin/capability-legal-review", label: "בדיקת יכולות", roles: ["admin"], dataTable: "observer_vertical_capability_decisions" },
  { route: "/dashboard/admin/legal-review", label: "סקירה משפטית", roles: ["admin"], dataTable: "legal_review_documents" },
  { route: "/dashboard/admin/observer-pilot", label: "פיילוט תצפיתן", roles: ["admin"], dataTable: "observer_pilot_runs" },
  { route: "/dashboard/admin/system-health", label: "בריאות מערכת", roles: ["admin"], dataTable: "audit_logs" },
  { route: "/dashboard/admin/audit-logs", label: "Audit Logs", roles: ["admin"], dataTable: "audit_logs" },
  { route: "/dashboard/admin/reports", label: "דוחות", roles: ["admin"], dataTable: "complaints" },
  { route: "/dashboard/admin/final-compliance-review", label: "סקירת ציות סופית", roles: ["admin"], dataTable: "final_compliance_gaps" },
  { route: "/dashboard/admin/security-review", label: "בדיקת חדירה", roles: ["admin"], dataTable: "penetration_test_scopes" },
  { route: "/dashboard/admin/master-qa", label: "Master QA", roles: ["admin"], dataTable: "qa_test_cases" },
  { route: "/dashboard/admin/first-pilot", label: "פיילוט ראשון", roles: ["admin"], dataTable: "pilot_kindergarten_profiles" },
  { route: "/dashboard/admin/settings", label: "הגדרות", roles: ["admin"] },
  { route: "/dashboard/admin/navigation-health", label: "בריאות ניווט", roles: ["admin"] },
  { route: "/dashboard/admin/user-journey-audit", label: "User Journey Audit", roles: ["admin"] },
  { route: "/dashboard/garden", label: "ניהול גן", roles: ["manager", "owner"], dataTable: "gardens", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/command-center", label: "מרכז פיקוד", roles: ["manager", "owner"], dataTable: "kindergarten_operational_health_scores", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/operations", label: "מערכת הפעלה", roles: ["manager", "owner"], dataTable: "daily_operations", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/children", label: "ילדים", roles: ["manager", "owner"], dataTable: "children", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/children/[id]/timeline", label: "ציר ילד", roles: ["manager", "owner"], dataTable: "child_timeline_events", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/finance", label: "כספים", roles: ["manager", "owner"], dataTable: "child_payment_history", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/parents", label: "הורים", roles: ["manager", "owner"], dataTable: "parents", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/staff", label: "צוות", roles: ["manager", "owner"], dataTable: "staff", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/attendance", label: "נוכחות", roles: ["manager", "owner"], dataTable: "attendance", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/child-journal", label: "יומן ילד", roles: ["manager", "owner"], dataTable: "child_daily_journals", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/health", label: "בריאות", roles: ["manager", "owner"], dataTable: "child_health_records", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/pickup", label: "איסוף", roles: ["manager", "owner"], dataTable: "pickup_events", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/incidents", label: "אירועים", roles: ["manager", "owner"], dataTable: "incident_reports", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/daily-journal", label: "יומן תפעול", roles: ["manager", "owner"], dataTable: "daily_operational_tasks", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/cameras", label: "מצלמות", roles: ["manager", "owner"], dataTable: "camera_streams", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/observer-pilot", label: "פיילוט תצפיתן", roles: ["manager", "owner"], dataTable: "skeleton_observer_events", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/tasks", label: "משימות", roles: ["manager", "owner"], dataTable: "tasks", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/documents", label: "מסמכים", roles: ["manager", "owner"], dataTable: "documents", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/inspections", label: "פיקוח", roles: ["manager", "owner"], dataTable: "inspections", requiredProfileField: "garden_id" },
  { route: "/dashboard/garden/notifications", label: "התראות גן", roles: ["manager", "owner"], dataTable: "notifications", requiredProfileField: "garden_id" },
  { route: "/dashboard/parent", label: "אזור הורים", roles: ["parent"], dataTable: "children" },
  { route: "/dashboard/parent/family-home", label: "בית משפחתי", roles: ["parent"], dataTable: "child_timeline_events" },
  { route: "/dashboard/parent/children/[id]/timeline", label: "ציר ילד", roles: ["parent"], dataTable: "child_timeline_events" },
  { route: "/dashboard/parent/daily-journal", label: "יומן יומי", roles: ["parent"], dataTable: "child_daily_journals" },
  { route: "/dashboard/parent/messages", label: "הודעות", roles: ["parent"], dataTable: "parent_child_requests" },
  { route: "/dashboard/parent/gallery", label: "גלריה", roles: ["parent"], dataTable: "gallery_items" },
  { route: "/dashboard/parent/pickup", label: "איסוף", roles: ["parent"], dataTable: "child_pickup_events" },
  { route: "/dashboard/parent/notifications", label: "התראות", roles: ["parent"], dataTable: "notifications" },
  { route: "/dashboard/parent/documents", label: "מסמכים", roles: ["parent"], dataTable: "documents" },
  { route: "/dashboard/parent/payments", label: "תשלומים", roles: ["parent"], dataTable: "children" },
  { route: "/dashboard/parent/inspections", label: "פיקוח", roles: ["parent"], dataTable: "inspections" },
  { route: "/dashboard/parent/complaints", label: "תלונות", roles: ["parent"], dataTable: "complaints" },
  { route: "/dashboard/staff", label: "צוות", roles: ["staff"], dataTable: "tasks" },
  { route: "/dashboard/staff/operations", label: "תפעול משמרת", roles: ["staff"], dataTable: "staff_shifts" },
  { route: "/dashboard/staff/child-journal", label: "יומן ילד", roles: ["staff"], dataTable: "child_daily_journals" },
  { route: "/dashboard/staff/daily-journal", label: "יומן תפעול", roles: ["staff"], dataTable: "daily_operational_tasks" },
  { route: "/dashboard/staff/tasks", label: "משימות", roles: ["staff"], dataTable: "tasks" },
  { route: "/dashboard/staff/documents", label: "מסמכים", roles: ["staff"], dataTable: "documents" },
  { route: "/dashboard/staff/shifts", label: "שעות", roles: ["staff"], dataTable: "staff_shifts" },
  { route: "/dashboard/staff/messages", label: "הודעות", roles: ["staff"], dataTable: "messages" },
  { route: "/dashboard/staff/notifications", label: "התראות צוות", roles: ["staff"], dataTable: "notifications" },
  { route: "/dashboard/inspector", label: "פקח", roles: ["inspector"], dataTable: "required_inspections" },
  { route: "/dashboard/inspector/command-center", label: "מרכז פיקוח שטח", roles: ["inspector"], dataTable: "required_inspections" },
  { route: "/dashboard/inspector/inspections", label: "ביקורות", roles: ["inspector"], dataTable: "inspections" },
  { route: "/dashboard/inspector/cameras", label: "מצלמות", roles: ["inspector"], dataTable: "camera_streams" },
  { route: "/dashboard/inspector/ai-events", label: "AI", roles: ["inspector"], dataTable: "ai_events" },
  { route: "/dashboard/inspector/observer-pilot", label: "פיילוט תצפיתן", roles: ["inspector"], dataTable: "skeleton_observer_events" },
  { route: "/dashboard/inspector/reports", label: "דיווחים", roles: ["inspector"], dataTable: "complaints" },
  { route: "/dashboard/inspector/tasks", label: "משימות", roles: ["inspector"], dataTable: "tasks" },
  { route: "/dashboard/inspector/violations", label: "ליקויים", roles: ["inspector"], dataTable: "violations" },
  { route: "/dashboard/inspector/notifications", label: "התראות מפקח", roles: ["inspector"], dataTable: "notifications" }
];

export function dashboardRouteExists(route: string) {
  const routePath = route.replace(/^\//, "");
  const dir = path.join(process.cwd(), "app", routePath);
  return fs.existsSync(path.join(dir, "page.tsx")) || fs.existsSync(path.join(dir, "page.ts")) || fs.existsSync(path.join(dir, "page.jsx"));
}
