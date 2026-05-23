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
          <p className="eyebrow">יצירה מאובטחת</p>
          <h1>פתיחת גנים, מנהלות ופקחים עם Auth, הרשאות ולוג ביקורת.</h1>
          <p>הסיסמה נוצרת זמנית ומוצגת פעם אחת בלבד לאדמין. לאחר הכניסה הראשונה המשתמש מסומן כמי שחייב להחליף סיסמה.</p>
        </div>
        <span className="pill good"><UserPlus size={15} /> Supabase Auth + profiles</span>
      </div>
      <AdminProvisioningPanel />
    </DashboardShell>
  );
}
