import { NextResponse } from "next/server";
import { createCrudHandlers } from "@/lib/crud-route";
import { attendanceSchema } from "@/lib/validation";
import { requireRole } from "@/lib/auth";

export const { GET } = createCrudHandlers({
  table: "attendance",
  read: "attendance:write",
  write: "attendance:write",
  schema: attendanceSchema,
  defaultOrder: "attendance_date"
});

// A Parent's GPS/signature request is not physical arrival or Staff-confirmed
// release. Keep historical read access, but fail closed on the old mutation.
export async function POST() {
  await requireRole(["parent"]);
  return NextResponse.json({ error: "נוכחות ושחרור מאושרים כעת על ידי צוות הגן בלבד." }, { status: 403 });
}
