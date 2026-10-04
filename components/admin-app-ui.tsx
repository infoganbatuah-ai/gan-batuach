import type { ReactNode } from "react";
import { RoleAppShell } from "@/components/role-app-shell";

type AdminProfile = {
  full_name?: string | null;
  profile_image_url?: string | null;
};

export function AdminAppFrame({
  profile,
  activeHref = "/dashboard/admin",
  children,
  title = "מרכז שליטה ארצי",
  subtitle = "תמונת מצב מלאה, מהירה ומדויקת לכל מערכת גן בטוח.",
  badge = "תפעול מבוקר",
  backHref
}: {
  profile: AdminProfile;
  activeHref?: string;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  backHref?: string;
}) {
  return (
    <RoleAppShell
      role="admin"
      activeHref={activeHref}
      title={title}
      subtitle={subtitle}
      profile={profile}
      backHref={backHref}
      actions={badge ? <span className="dashboard-header-badge">{badge}</span> : undefined}
      className="admin-runtime-shell"
    >
      <div className="admin-app-page dashboard-runtime-content">
        {children}
      </div>
    </RoleAppShell>
  );
}
