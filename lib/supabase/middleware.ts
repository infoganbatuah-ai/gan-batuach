import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  await supabase.auth.getUser();
    // --- ISO 27001 / 27701 COMPLIANCE AUDIT LOG MIDDLEWARE ---
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const logEntry = {
      timestamp: new Date().toISOString(),
      user_uuid: user?.id || 'UNAUTHENTICATED_GUEST',
      user_role: user?.role || 'GUEST',
      action: `${request.method} ${request.nextUrl.pathname}`,
      source_ip: request.headers.get('x-forwarded-for') || 'UNKNOWN_IP',
      device_fingerprint: request.headers.get('user-agent') || 'UNKNOWN_DEVICE',
      status_code: response.status
    };
    console.log('⚠️ [ISO COMPLIANCE AUDIT LOG]:', JSON.stringify(logEntry));
  } catch (logError) {
    console.error('Audit logging failed:', logError);
  }
  // ---------------------------------------------------------

  return response;
}
