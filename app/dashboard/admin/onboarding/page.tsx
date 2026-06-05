import { UserPlus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminProvisioningPanel } from "@/components/provisioning-forms";
import { requireRole } from "@/lib/auth";

export default async function AdminOnboardingPage() {
  await requireRole(["admin"]);

  return (
    <DashboardShell role="admin" title="פתיחת משתמשים">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">פתיחה מסודרת</p>
          <h1>פתיחת גנים, מנהלות ופקחים בתהליך קצר וברור.</h1>
          <p>המערכת תציג פרטי כניסה זמניים בצורה מסודרת ותכוון את המשתמש להחלפת סיסמה בכניסה הראשונה.</p>
        </div>
        <span className="pill good"><UserPlus size={15} /> מוכן להפעלה</span>
      </div>
      <AdminProvisioningPanel />
    </DashboardShell>
  );
}
