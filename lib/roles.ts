export const roles = ["admin", "network_manager", "inspector", "manager", "owner", "staff", "parent"] as const;

export type UserRole = (typeof roles)[number];

export type Permission =
  | "gardens:read"
  | "gardens:write"
  | "children:read"
  | "children:write"
  | "staff:read"
  | "staff:write"
  | "inspections:read"
  | "inspections:write"
  | "inspection_forms:write"
  | "violations:write"
  | "tasks:write"
  | "messages:write"
  | "complaints:write"
  | "child_journal:read"
  | "child_journal:write"
  | "medical_data:read"
  | "medical_data:write"
  | "documents:read"
  | "documents:write"
  | "documents:approve"
  | "documents:download"
  | "attendance:write"
  | "cameras:read"
  | "cameras:write"
  | "video:stream"
  | "ai_events:read"
  | "ai_events:write"
  | "billing:read"
  | "billing:write"
  | "audit_logs:read";

export const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    "gardens:read",
    "gardens:write",
    "children:read",
    "children:write",
    "staff:read",
    "staff:write",
    "inspections:read",
    "inspections:write",
    "inspection_forms:write",
    "violations:write",
    "tasks:write",
    "messages:write",
    "complaints:write",
    "child_journal:read",
    "child_journal:write",
    "medical_data:read",
    "medical_data:write",
    "documents:read",
    "documents:write",
    "documents:approve",
    "documents:download",
    "attendance:write",
    "cameras:read",
    "cameras:write",
    "video:stream",
    "ai_events:read",
    "ai_events:write",
    "billing:read",
    "billing:write",
    "audit_logs:read"
  ],
  network_manager: [
    "gardens:read",
    "staff:read",
    "inspections:read",
    "tasks:write",
    "messages:write",
    "complaints:write",
    "documents:read",
    "documents:download",
    "cameras:read",
    "ai_events:read",
    "billing:read",
    "audit_logs:read"
  ],
  inspector: [
    "gardens:read",
    "children:read",
    "staff:read",
    "inspections:read",
    "inspections:write",
    "violations:write",
    "tasks:write",
    "messages:write",
    "complaints:write",
    "child_journal:read",
    "medical_data:read",
    "documents:read",
    "documents:write",
    "documents:approve",
    "documents:download",
    "cameras:read",
    "video:stream",
    "ai_events:read",
    "billing:read",
    "billing:write"
  ],
  manager: [
    "gardens:read",
    "gardens:write",
    "children:read",
    "children:write",
    "staff:read",
    "staff:write",
    "inspections:read",
    "tasks:write",
    "messages:write",
    "complaints:write",
    "child_journal:read",
    "child_journal:write",
    "medical_data:read",
    "medical_data:write",
    "documents:read",
    "documents:write",
    "documents:approve",
    "documents:download",
    "attendance:write",
    "cameras:read",
    "cameras:write",
    "video:stream",
    "ai_events:read",
    "billing:read",
    "billing:write"
  ],
  owner: [
    "gardens:read",
    "gardens:write",
    "children:read",
    "children:write",
    "staff:read",
    "staff:write",
    "inspections:read",
    "tasks:write",
    "messages:write",
    "complaints:write",
    "child_journal:read",
    "child_journal:write",
    "medical_data:read",
    "medical_data:write",
    "documents:read",
    "documents:write",
    "documents:approve",
    "documents:download",
    "attendance:write",
    "cameras:read",
    "cameras:write",
    "video:stream",
    "ai_events:read"
  ],
  staff: ["gardens:read", "children:read", "messages:write", "attendance:write", "tasks:write", "child_journal:read", "child_journal:write", "medical_data:read", "documents:read", "documents:write", "cameras:read", "video:stream"],
  parent: ["children:read", "children:write", "messages:write", "complaints:write", "attendance:write", "cameras:read", "video:stream", "child_journal:read", "medical_data:read", "documents:read", "documents:download"]
};

export function hasPermission(role: UserRole | null | undefined, permission: Permission) {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function isRole(value: unknown): value is UserRole {
  return typeof value === "string" && roles.includes(value as UserRole);
}
