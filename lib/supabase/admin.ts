import { createClient } from "@supabase/supabase-js";

export function isAdminClientConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function assertAdminClientConfigured() {
  if (!isAdminClientConfigured()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin provisioning. Add it to Vercel Environment Variables.");
  }
}

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
