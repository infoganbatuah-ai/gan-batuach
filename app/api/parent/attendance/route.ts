import { NextResponse } from "next/server";
import { createCrudHandlers } from "@/lib/crud-route";
import { attendanceSchema } from "@/lib/validation";
import { getSessionProfile, requireRole } from "@/lib/auth";

const { GET: readAttendance } = createCrudHandlers({
  table: "attendance",
  read: "attendance:write",
  write: "attendance:write",
  schema: attendanceSchema,
  defaultOrder: "attendance_date"
});

export async function GET(request: Request) {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return readAttendance(request);
}

// A Parent's GPS/signature request is not physical arrival or Staff-confirmed
// release. Keep historical read access, but fail closed on the old mutation.
export async function POST() {
  await requireRole(["parent"]);
  return NextResponse.json({ error: "נוכחות ושחרור מאושרים כעת על ידי צוות הגן בלבד." }, { status: 403 });
}
