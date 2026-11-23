type ParentAccessClient = {
  from: (table: string) => {
    select: (columns: string) => {
      or: (filter: string) => {
        limit: (count: number) => {
          maybeSingle: () => PromiseLike<{ data: { id?: string } | null; error?: unknown }>;
        };
      };
    };
  };
};

export async function hasExplicitGanBatuachAccess(
  client: ParentAccessClient,
  profile: { id?: string | null; role?: string | null }
) {
  if (!profile.id || !profile.role) return false;
  if (profile.role !== "parent") return true;

  const result = await client
    .from("parents")
    .select("id")
    .or(`profile_id.eq.${profile.id},user_id.eq.${profile.id}`)
    .limit(1)
    .maybeSingle();

  return !result.error && Boolean(result.data?.id);
}
