import { fail, handleRouteError } from "@/lib/api";
import { POST as deviceHeartbeat } from "../device-heartbeat/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A separate URL fails closed on deployments without the status-only contract.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)
      || !body.runtime || typeof body.runtime !== "object" || Array.isArray(body.runtime)) {
      return fail("Invalid media heartbeat.", 422);
    }
    return deviceHeartbeat(new Request(request.url, {
      method: "POST", headers: request.headers, signal: request.signal,
      body: JSON.stringify({ ...body, runtime: { ...body.runtime, operation_mode: "MEDIA_ONLY" } })
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
