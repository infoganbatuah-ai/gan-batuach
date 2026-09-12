import { randomUUID } from "node:crypto";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const types = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["application/pdf", "pdf"]]);

async function authorizedInspection(id: string, write: boolean) {
  const access = await getOperationalRoleContext(write ? ["inspector"] : ["admin", "manager", "owner", "inspector"]);
  if (!access.allowed) return { response: access.response, inspection: null };
  const supabase = await createClient();
  const { data } = await supabase.from("inspections" as never).select("id,garden_id,inspector_id,status").eq("id", id).maybeSingle();
  const inspection = data as { id: string; garden_id: string; inspector_id: string; status: string } | null;
  if (!inspection) return { response: fail("ביקורת לא נמצאה", 404), inspection: null };
  const actor = access.session.profile;
  if (actor.role === "inspector" && inspection.inspector_id !== actor.id) return { response: fail("אין הרשאה לביקורת", 403), inspection: null };
  if ((actor.role === "owner" || actor.role === "manager") && !access.gardenIds?.includes(inspection.garden_id)) return { response: fail("אין הרשאה לביקורת", 403), inspection: null };
  if (write && !["open", "in_progress"].includes(inspection.status)) return { response: fail("הביקורת נעולה", 409), inspection: null };
  return { response: null, inspection };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await authorizedInspection(id, true);
    if (access.response) return access.response;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !types.has(file.type) || file.size > 12 * 1024 * 1024 || file.size === 0) return fail("קובץ הראיה אינו נתמך", 422);
    const path = `inspections/${id}/${randomUUID()}.${types.get(file.type)}`;
    const storage = createAdminClient().storage.from("inspection-reports");
    const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
    if (error) return fail("שמירת הראיה נכשלה", 503);
    return ok({ path: `inspection-reports/${path}` });
  } catch (error) { return handleRouteError(error); }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await authorizedInspection(id, false);
    if (access.response) return access.response;
    const path = new URL(request.url).searchParams.get("path") ?? "";
    const prefix = `inspection-reports/inspections/${id}/`;
    if (!path.startsWith(prefix) || !/^inspection-reports\/[a-zA-Z0-9/_\-.]+$/.test(path)) return fail("נתיב ראיה לא תקין", 422);
    const { data, error } = await createAdminClient().storage.from("inspection-reports").createSignedUrl(path.slice("inspection-reports/".length), 60);
    if (error || !data?.signedUrl) return fail("ראיה לא נמצאה", 404);
    return Response.redirect(data.signedUrl, 302);
  } catch (error) { return handleRouteError(error); }
}
