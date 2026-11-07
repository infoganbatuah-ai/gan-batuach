import "server-only";

import { createClient } from "@supabase/supabase-js";

function adminSupabaseUrl() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const qualificationUrl = process.env.SUPABASE_ADMIN_URL;
  if (!qualificationUrl) return publicUrl;
  if (process.env.OBSERVER_PUSH38_QUALIFICATION !== "enabled") {
    throw new Error("SUPABASE_ADMIN_URL is restricted to the isolated PUSH 38 qualification environment.");
  }
  const parsed = new URL(qualificationUrl);
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1") {
    throw new Error("SUPABASE_ADMIN_URL must use the isolated loopback-only qualification adapter.");
  }
  return qualificationUrl;
}

export function isAdminClientConfigured() {
  return Boolean(adminSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function assertAdminClientConfigured() {
  if (!isAdminClientConfigured()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin provisioning. Add it to Vercel Environment Variables.");
  }
}

export function createAdminClient() {
  const supabaseUrl = adminSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin provisioning. Add it to Vercel Environment Variables.");
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
