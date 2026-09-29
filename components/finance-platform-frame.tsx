import type { ReactNode } from "react";
import { RoleAppShell } from "@/components/role-app-shell";

export function FinanceFrame({ role, name, avatarUrl, activeHref, children, title = "מרכז כספים", subtitle = "שכר לימוד ומנוי — בשני מסלולים נפרדים" }: {
  role: "owner" | "manager" | "parent" | "admin";
  name?: string | null;
  avatarUrl?: string | null;
  activeHref: string;
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return <RoleAppShell role={role} activeHref={activeHref} title={title} subtitle={subtitle} profile={{ full_name: name, profile_image_url: avatarUrl }} className="finance-role-shell">
    <div className="finance-platform">{children}</div>
  </RoleAppShell>;
}
