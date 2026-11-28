export type SafeResult<T> = { data: T; error: string | null };

export async function safeAdminData<T>(label: string, loader: () => Promise<T>, fallback: T): Promise<SafeResult<T>> {
  try {
    const data = await loader();
    return { data, error: null };
  } catch (error) {
    console.warn("Admin page data unavailable:", label);
    return { data: fallback, error: "לא ניתן לטעון את הנתונים כרגע" };
  }
}

export function logSupabaseError(label: string, error: unknown) {
  if (error) console.warn("Admin Supabase query unavailable:", label);
}

export type AdminReadState = "complete" | "partial" | "unavailable";

export function adminBoundedRows<T>(result: { data: T[] | null; count: number | null; error: unknown }): { rows: T[]; state: AdminReadState } {
  if (result.error || !Array.isArray(result.data) || typeof result.count !== "number" || !Number.isInteger(result.count) || result.count < 0) {
    return { rows: [], state: "unavailable" };
  }
  if (result.data.length > result.count) {
    return { rows: [], state: "unavailable" };
  }
  if (result.data.length < result.count) {
    return { rows: result.data, state: "partial" };
  }
  return { rows: result.data, state: "complete" };
}
