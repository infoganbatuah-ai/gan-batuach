import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class SafeHttpError extends Error {
  constructor(
    public readonly code: "CSRF_REJECTED" | "PAYLOAD_TOO_LARGE" | "INVALID_JSON" | "RATE_LIMIT_EXCEEDED" | "RATE_LIMIT_UNAVAILABLE" | "INTERNAL_TOOL_UNAVAILABLE",
    public readonly status: 400 | 403 | 404 | 413 | 429 | 503
  ) {
    super(code);
    this.name = "SafeHttpError";
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("חסרים פרטים או שיש שדה לא תקין בטופס.", 422, error.flatten());
  }
  if (error instanceof SafeHttpError) return safeHttpErrorResponse(error);
  const isProduction = process.env.APP_ENV === "production"
    || process.env.VERCEL_ENV === "production"
    || process.env.NODE_ENV === "production";
  if (isProduction) {
    const errorCode = error && typeof error === "object" && "code" in error
      ? String(error.code).slice(0, 80)
      : "UNCLASSIFIED";
    console.error("Route error", {
      errorType: error instanceof Error ? error.name : typeof error,
      errorCode
    });
    return fail("הפעולה נכשלה בשרת.", 500);
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  console.error("Route error", error);
  return fail("הפעולה נכשלה בשרת. " + message, 500);
}

function safeHttpErrorResponse(error: SafeHttpError) {
  const message = error.code === "CSRF_REJECTED"
    ? "מקור הבקשה אינו מורשה."
    : error.code === "PAYLOAD_TOO_LARGE"
      ? "הבקשה גדולה מדי."
      : error.code === "INVALID_JSON"
        ? "מבנה הבקשה אינו תקין."
        : error.code === "RATE_LIMIT_EXCEEDED"
          ? "בוצעו יותר מדי בקשות. יש להמתין ולנסות שוב."
          : error.code === "INTERNAL_TOOL_UNAVAILABLE"
            ? "הנתיב אינו זמין."
            : "מנגנון הגנת הבקשות אינו זמין כרגע.";
  return fail(message, error.status);
}

export function handleSafeRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("חסרים פרטים או שיש שדה לא תקין בטופס.", 422, error.flatten());
  }
  if (error instanceof SafeHttpError) {
    return safeHttpErrorResponse(error);
  }
  const errorCode = error && typeof error === "object" && "code" in error
    ? String(error.code).slice(0, 80)
    : "UNCLASSIFIED";
  console.error("Canonical API request failed", {
    errorType: error instanceof Error ? error.name : typeof error,
    errorCode
  });
  return fail("הפעולה נכשלה בשרת.", 500);
}
