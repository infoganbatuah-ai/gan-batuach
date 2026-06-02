import { NextResponse } from "next/server";
import { ZodError } from "zod";

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
  const message = error instanceof Error ? error.message : "Unexpected server error";
  console.error("Route error", error);
  return fail("הפעולה נכשלה בשרת. " + message, 500);
}
