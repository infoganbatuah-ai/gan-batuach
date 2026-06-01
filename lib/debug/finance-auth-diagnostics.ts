import { cookies } from "next/headers";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function loadFinanceAuthDiagnostics() {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  const sessionProfile = await getSessionProfile();

  return {
    supabase,
    cookieNames,
    getUser: {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      error: userError?.message ?? null
    },
    getSession: {
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      expiresAt: session?.expires_at ?? null,
      error: sessionError?.message ?? null
    },
    sessionProfile: {
      userId: sessionProfile.user?.id ?? null,
      profileId: sessionProfile.profile?.id ?? null,
      role: sessionProfile.profile?.role ?? null,
      gardenId: sessionProfile.profile?.garden_id ?? sessionProfile.profile?.kindergarten_id ?? null,
      profile: sessionProfile.profile
    }
  };
}
