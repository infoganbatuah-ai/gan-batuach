export type SafeResult<T> = { data: T; error: string | null };

export async function safeAdminData<T>(label: string, loader: () => Promise<T>, fallback: T): Promise<SafeResult<T>> {
  try {
    const data = await loader();
    return { data, error: null };
  } catch (error) {
    console.error("Admin page data failed:", label, error);
    return { data: fallback, error: "לא ניתן לטעון את הנתונים כרגע" };
  }
}

export function logSupabaseError(label: string, error: unknown) {
  if (error) console.error("Admin Supabase query failed:", label, error);
}
