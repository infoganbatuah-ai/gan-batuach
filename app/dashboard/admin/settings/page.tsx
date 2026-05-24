import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function AdminSettingsPage() {
  await requireRole(["admin"]);
  return <DashboardShell role="admin" title="הגדרות מערכת"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Settings</p><h1>הגדרות מערכת והרשאות.</h1><p>מסך הגדרות אדמין בטוח. אין כאן קריאה לנתונים שעלולה להפיל את הניווט.</p></div><span className="pill good">UI route</span></div><section className="grid cols-3 dashboard-panels"><article className="card action-panel"><h2>RBAC</h2><p>ניהול הרשאות לפי תפקיד.</p></article><article className="card action-panel"><h2>Supabase</h2><p>בדיקת חיבור וסכמות.</p></article><article className="card action-panel"><h2>אבטחה</h2><p>2FA, Passkeys ולוגים.</p></article></section></DashboardShell>;
}
