import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import type { UserRole } from "@/lib/roles";

const navByRole: Record<UserRole, Array<{ href: string; label: string }>> = {
  admin: [
    { href: "/dashboard/admin", label: "מרכז שליטה" },
    { href: "/api/gardens", label: "API גנים" },
    { href: "/api/leads", label: "API לידים" },
    { href: "/api/audit-logs", label: "Audit logs" }
  ],
  inspector: [
    { href: "/dashboard/inspector", label: "ביקורות" },
    { href: "/api/inspections", label: "API ביקורות" },
    { href: "/api/violations", label: "API ליקויים" }
  ],
  manager: [
    { href: "/dashboard/garden", label: "ניהול גן" },
    { href: "/api/children", label: "API ילדים" },
    { href: "/api/attendance", label: "API נוכחות" }
  ],
  staff: [
    { href: "/dashboard/staff", label: "צוות" },
    { href: "/api/attendance", label: "API נוכחות" },
    { href: "/api/messages", label: "API הודעות" }
  ],
  parent: [
    { href: "/dashboard/parent", label: "אזור הורים" },
    { href: "/api/children", label: "API ילדים" },
    { href: "/api/complaints", label: "API תלונות" }
  ]
};

export function DashboardShell({ role, title, children }: { role: UserRole; title: string; children: React.ReactNode }) {
  return (
    <>
      <BrandHeader />
      <div className="dashboard-layout">
        <aside className="sidebar">
          <h2>{title}</h2>
          <nav>
            {navByRole[role].map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="dashboard-main">{children}</main>
      </div>
    </>
  );
}
