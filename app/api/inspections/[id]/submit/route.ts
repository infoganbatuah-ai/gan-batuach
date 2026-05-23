import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { inspectionSubmitSchema, submitInspection } from "@/lib/domain/inspection-engine";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "inspector"]);
    const { id } = await params;
    const payload = inspectionSubmitSchema.parse(await request.json());
    const result = await submitInspection(id, payload);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inspection submit failed";
    if (message.includes("GPS verification failed") || message.includes("Garden GPS is missing")) {
      return fail(message, 422);
    }
    return handleRouteError(error);
  }
}
