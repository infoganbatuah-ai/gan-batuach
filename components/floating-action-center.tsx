import Link from "next/link";
import { ClipboardCheck, MessageSquareText, Plus, UserRound, UsersRound } from "lucide-react";
import type { UserRole } from "@/lib/roles";

const actionByRole: Record<UserRole, Array<{ label: string; href: string; icon: typeof Plus }>> = {
  admin: [
    { label: "משימה", href: "/dashboard/admin/tasks", icon: ClipboardCheck },
    { label: "הודעה", href: "/dashboard/admin/notifications", icon: MessageSquareText },
    { label: "גן", href: "/dashboard/admin/users/new-kindergarten", icon: Plus }
  ],
  network_manager: [
    { label: "רשת", href: "/dashboard/admin/enterprise", icon: UsersRound },
    { label: "הודעה", href: "/dashboard/admin/communications", icon: MessageSquareText },
    { label: "משימה", href: "/dashboard/tasks", icon: ClipboardCheck }
  ],
  manager: [
    { label: "ילד", href: "/dashboard/garden/children", icon: UserRound },
    { label: "צוות", href: "/dashboard/garden/staff", icon: UsersRound },
    { label: "הודעה", href: "/dashboard/garden/communication", icon: MessageSquareText },
    { label: "משימה", href: "/dashboard/garden/tasks", icon: ClipboardCheck }
  ],
  owner: [
    { label: "ילד", href: "/dashboard/garden/children", icon: UserRound },
    { label: "צוות", href: "/dashboard/garden/staff", icon: UsersRound },
    { label: "הודעה", href: "/dashboard/garden/communication", icon: MessageSquareText },
    { label: "משימה", href: "/dashboard/garden/tasks", icon: ClipboardCheck }
  ],
  staff: [
    { label: "דיווח", href: "/dashboard/staff/incidents", icon: Plus },
    { label: "עדכון ילד", href: "/dashboard/staff/child-journal", icon: UserRound },
    { label: "משימה", href: "/dashboard/staff/tasks", icon: ClipboardCheck }
  ],
  inspector: [
    { label: "ביקורת", href: "/dashboard/inspector/inspections", icon: ClipboardCheck },
    { label: "דיווח", href: "/dashboard/inspector/reports", icon: Plus },
    { label: "משימה", href: "/dashboard/inspector/tasks", icon: ClipboardCheck }
  ],
  parent: [
    { label: "הודעה", href: "/dashboard/parent/messages", icon: MessageSquareText },
    { label: "איסוף", href: "/dashboard/parent/pickup", icon: UserRound },
    { label: "פנייה", href: "/dashboard/parent/complaints", icon: Plus }
  ]
};

export function FloatingActionCenter({ role }: { role: UserRole }) {
  return (
    <details className="floating-action-center">
      <summary aria-label="פעולות מהירות"><Plus size={22} /></summary>
      <div>
        {actionByRole[role].map((action) => {
          const Icon = action.icon;
          return (
            <Link href={action.href} key={`${action.href}-${action.label}`}>
              <Icon size={17} />
              <span>{action.label}</span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}
