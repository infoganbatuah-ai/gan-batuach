import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const types = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["application/pdf", "pdf"]]);

async function authorize(id: string, write: boolean) {
  const access = await getOperationalRoleContext(write ? ["manager", "owner"] : ["admin", "manager", "owner", "inspector"]);
  if (!access.allowed) return { response: access.response, violation: null };
  if (!z.string().uuid().safeParse(id).success) return { response: fail("מזהה ליקוי לא תקין", 422), violation: null };
  const { data, error } = await (await createClient()).from("violations" as never).select("id,garden_id,status,correction_files").eq("id", id).maybeSingle();
  if (error || !data) return { response: fail("ליקוי לא נמצא", 404), violation: null };
  const violation = data as { id: string; garden_id: string; status: string; correction_files: string[] };
  if (write && !access.gardenIds?.includes(violation.garden_id)) return { response: fail("אין הרשאה לגן", 403), violation: null };
  if (write && violation.status === "done") return { response: fail("התיקון סגור", 409), violation: null };
  return { response: null, violation };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await authorize(id, true);
    if (access.response) return access.response;
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !types.has(file.type) || file.size > 12 * 1024 * 1024 || file.size === 0) return fail("קובץ ראיה לא נתמך", 422);
    const path = `corrective-actions/${id}/${randomUUID()}.${types.get(file.type)}`;
    const { error } = await createAdminClient().storage.from("inspection-reports").upload(path, file, { contentType: file.type, upsert: false });
    if (error) return fail("שמירת ראיה נכשלה", 503);
    return ok({ path: `inspection-reports/${path}` });
  } catch (error) { return handleRouteError(error); }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await authorize(id, false);
    if (access.response) return access.response;
    const path = new URL(request.url).searchParams.get("path") ?? "";
    const prefix = `inspection-reports/corrective-actions/${id}/`;
    if (!path.startsWith(prefix) || !/^inspection-reports\/[a-zA-Z0-9/_\-.]+$/.test(path) || !access.violation?.correction_files?.includes(path)) return fail("ראיה לא נמצאה", 404);
    const { data, error } = await createAdminClient().storage.from("inspection-reports").createSignedUrl(path.slice("inspection-reports/".length), 60);
    if (error || !data?.signedUrl) return fail("ראיה לא נמצאה", 404);
    return Response.redirect(data.signedUrl, 302);
  } catch (error) { return handleRouteError(error); }
}
