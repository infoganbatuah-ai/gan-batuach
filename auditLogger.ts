import { NextRequest, NextResponse } from "next/server";

export async function logComplianceAudit(request: NextRequest, response: NextResponse, userId?: string, userRole?: string) {
  const start = Date.now();

  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      user_uuid: userId || 'UNAUTHENTICATED_GUEST',
      user_role: userRole || 'GUEST',
      action: `${request.method} ${request.nextUrl.pathname}`,
      source_ip: request.headers.get('x-forwarded-for') || 'UNKNOWN_IP',
      device_fingerprint: request.headers.get('user-agent') || 'UNKNOWN_DEVICE',
      execution_time_ms: Date.now() - start,
      status_code: response.status
    };

    // הדפסה מאובטחת לקונסול - ורסל שואבת את זה אוטומטית ללוגים חסיני מחיקה של ה-ISO
    console.log('⚠️ [ISO COMPLIANCE AUDIT LOG]:', JSON.stringify(logEntry));
  } catch (logError) {
    console.error('Audit logging failed:', logError);
  }
}
