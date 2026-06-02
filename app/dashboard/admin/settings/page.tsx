import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireRole } from "@/lib/auth";

export default async function AdminSettingsPage() {
  const { profile } = await requireRole(["admin"]);

  return (
    <DashboardShell role="admin" title="הגדרות אדמין">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Admin Settings</p>
          <h1>שלום, מנהל המערכת {profile.full_name}</h1>
          <p>כאן מעדכנים פרטי פרופיל, תמונת משתמש, פרטי קשר והעדפות התראה בלי לצאת ממרכז השליטה.</p>
        </div>
        <span className="pill good">פרופיל אדמין</span>
      </div>

      <ProfileSettingsForm profile={profile} roleLabel="מנהל מערכת" />
    </DashboardShell>
  );
}
