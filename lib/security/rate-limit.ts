import { createAdminClient } from "@/lib/supabase/admin";

export async function assertRateLimit(identifier: string, route: string, limit = 60, windowSeconds = 60) {
  const supabase = createAdminClient();
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();

  const { data: existing } = await supabase
    .from("rate_limit_events")
    .select("*")
    .eq("identifier", identifier)
    .eq("route", route)
    .eq("window_start", windowStart)
    .maybeSingle();

  const nextHits = Number((existing as any)?.hits ?? 0) + 1;
  const query = existing
    ? supabase.from("rate_limit_events").update({ hits: nextHits, blocked: nextHits > limit } as any).eq("id", (existing as any).id)
    : supabase.from("rate_limit_events").insert({ identifier, route, window_start: windowStart, hits: 1, blocked: false } as any);

  const { data, error } = await query.select("*").single();

  if (error) throw new Error(error.message);

  const hits = Number((data as any).hits ?? 1);
  if (hits > limit) {
    await supabase.from("rate_limit_events").update({ blocked: true } as any).eq("id", (data as any).id);
    throw new Error("Rate limit exceeded");
  }
}
