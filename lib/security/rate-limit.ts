import { createAdminClient } from "@/lib/supabase/admin";
import { SafeHttpError } from "@/lib/api";

type RateLimitResult = { hits: number; blocked: boolean };
type RateLimitRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{
    data: RateLimitResult[] | RateLimitResult | null;
    error: { code?: string } | null;
  }>;
};

export async function assertRateLimit(identifier: string, route: string, limit = 60, windowSeconds = 60) {
  const supabase = createAdminClient();
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
  const { data, error } = await (supabase as unknown as RateLimitRpcClient).rpc("consume_rate_limit", {
    requested_identifier: identifier.slice(0, 180),
    requested_route: route.slice(0, 120),
    requested_limit: Math.max(1, Math.min(limit, 10_000)),
    requested_window_start: windowStart
  });
  if (error || !data) throw new SafeHttpError("RATE_LIMIT_UNAVAILABLE", 503);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.blocked || Number(result.hits) > limit) {
    throw new SafeHttpError("RATE_LIMIT_EXCEEDED", 429);
  }
}
