export const roles = ["admin", "inspector", "manager", "staff", "parent"] as const;

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
  | "documents:write"
  | "attendance:write"
  | "cameras:read"
  | "cameras:write"
  | "video:stream"
  | "ai_events:read"
  | "ai_events:write"
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
    "documents:write",
    "attendance:write",
    "cameras:read",
    "cameras:write",
    "video:stream",
    "ai_events:read",
    "ai_events:write",
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
    "documents:write",
    "cameras:read",
    "video:stream",
    "ai_events:read"
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
    "documents:write",
    "attendance:write",
    "cameras:read",
    "cameras:write",
    "video:stream",
    "ai_events:read"
  ],
  staff: ["gardens:read", "children:read", "messages:write", "attendance:write", "tasks:write"],
  parent: ["children:read", "children:write", "messages:write", "complaints:write", "attendance:write", "cameras:read", "video:stream", "ai_events:read"]
};

export function hasPermission(role: UserRole | null | undefined, permission: Permission) {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function isRole(value: unknown): value is UserRole {
  return typeof value === "string" && roles.includes(value as UserRole);
}
