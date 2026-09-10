import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { handleRouteError, ok } from "@/lib/api";
import { escalateTask, escalateTaskSchema } from "@/lib/domain/tasks";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getOperationalRoleContext(["admin", "inspector"]);
    if (!access.allowed) return access.response;
    const { id } = await params;
    const { reason } = escalateTaskSchema.parse(await request.json());
    return ok(await escalateTask(id, reason));
  } catch (error) {
    return handleRouteError(error);
  }
}
