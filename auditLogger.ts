import { NextRequest, NextResponse } from "next/server";

export async function logComplianceAudit(request: NextRequest, response: NextResponse, userId?: string, userRole?: string) {
  const start = Date.now();

  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      authenticated: Boolean(userId),
      user_role: userRole || "GUEST",
      action: `${request.method} ${request.nextUrl.pathname}`,
      execution_time_ms: Date.now() - start,
      status_code: response.status
    };

    if (process.env.NODE_ENV !== "production") console.info("Compliance request summary", logEntry);
  } catch (logError) {
    console.error("Audit logging failed", { error: logError instanceof Error ? logError.message : "unknown_error" });
  }
}
