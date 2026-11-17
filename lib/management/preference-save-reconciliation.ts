export type PreferenceSnapshot = {
  preferences: Record<string, unknown>;
  push_category_preferences: Record<string, boolean>;
};

export type PreferenceSaveResult =
  | { status: "saved" }
  | { status: "account_changed"; message: string }
  | { status: "reconciled"; snapshot: PreferenceSnapshot; message: string }
  | { status: "unknown"; message: string };

const failureMessage = "השמירה לא הושלמה. הבחירות המוצגות נטענו מחדש מהשרת; בדקו אותן ונסו שוב.";
const unknownMessage = "לא ניתן לאמת מה נשמר. העדפות העריכה הוסתרו; נסו לטעון אותן מחדש.";
const accountChangedMessage = "החשבון השתנה מאז פתיחת הטופס. לא בוצעה שמירה; רעננו את העמוד כדי לטעון את העדפות החשבון הנוכחי.";

export async function loadPersistedPreferences(request: typeof fetch): Promise<PreferenceSnapshot | null> {
  try {
    const response = await request("/api/profile/communication-preferences", { method: "GET", cache: "no-store" });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("data" in body)) return null;
    const data = body.data;
    if (!data || typeof data !== "object" || !("preferences" in data) || !("push_category_preferences" in data)) return null;
    const preferences = data.preferences;
    const categories = data.push_category_preferences;
    if (!preferences || typeof preferences !== "object" || Array.isArray(preferences) ||
        !categories || typeof categories !== "object" || Array.isArray(categories) ||
        !Object.values(categories).every((value) => typeof value === "boolean")) return null;
    return { preferences: preferences as Record<string, unknown>, push_category_preferences: categories as Record<string, boolean> };
  } catch {
    return null;
  }
}

export async function saveAndReconcilePreferences(request: typeof fetch, payload: unknown): Promise<PreferenceSaveResult> {
  try {
    const response = await request("/api/profile/communication-preferences", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    // A stale-account response is definitive. Reading the new account's
    // preferences into the old account's mounted form would mix identities.
    if (response.status === 409) return { status: "account_changed", message: accountChangedMessage };
    const body: unknown = await response.json();
    if (response.ok && body && typeof body === "object" && "data" in body) return { status: "saved" };
  } catch {
    // The write may have committed before a network or parsing failure. Read it back.
  }
  const snapshot = await loadPersistedPreferences(request);
  return snapshot ? { status: "reconciled", snapshot, message: failureMessage } : { status: "unknown", message: unknownMessage };
}
