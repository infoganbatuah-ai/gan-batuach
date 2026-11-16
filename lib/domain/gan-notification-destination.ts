// Notification payloads and stored action URLs are navigation hints, not
// trusted authorization. The destination page still checks the user's role.
export function safeGanNotificationDestination(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 ||
      !value.startsWith("/") || value.startsWith("//") ||
      /[\\#\s]/.test(value) || /%2f|%5c/i.test(value)) return null;
  const path = value.split("?")[0];
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return null; }
  if (decoded.includes("..") || decoded.includes("//") || decoded.includes("\\")) return null;
  if (path === "/dashboard" || path.startsWith("/dashboard/") ||
      path === "/parent-onboarding" || path.startsWith("/parent-onboarding/")) return value;
  return null;
}
