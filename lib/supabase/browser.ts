import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // The shared /auth/callback route exchanges the one-time PKCE code.
      // Supabase's automatic URL detection would consume it first, leaving
      // the explicit callback to report a false confirmation failure.
      auth: { detectSessionInUrl: false },
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      }
    }
  );
}
