const fallback = "/digital-observer/dashboard";
const base = "https://observer-return.invalid";

// A URL parser normalizes dot segments before redirecting. Validate the raw
// path first so an encoded traversal cannot escape the Observer product path.
export function safeObserverReturnPath(value?: string | null): string {
  if (!value || value.length > 2_048 || /[\\\u0000-\u001f\u007f#]/.test(value) || value.startsWith("//")) return fallback;
  const path = value.split("?", 1)[0];
  if (path !== "/digital-observer" && !path.startsWith("/digital-observer/")) return fallback;
  if (path.includes("%") || path.includes("//")) return fallback;
  try {
    const parsed = new URL(value, base);
    if (parsed.origin !== base || parsed.pathname !== path) return fallback;
    return value;
  } catch {
    return fallback;
  }
}
