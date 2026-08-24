import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createDvrConnection, dvrConnectionSchema } from "@/lib/domain/video-gateway";

const localDvrOnboardingSchema = dvrConnectionSchema.extend({
  gateway_url: z.string().url(),
  gateway_secret: z.string().min(16)
});

function safeEqual(left: string | null, right: string | undefined) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isLocalGatewayUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    if (process.env.LOCAL_DVR_ONBOARDING_ENABLED !== "true") {
      return fail("Local DVR onboarding is disabled.", 404);
    }
    if (!safeEqual(request.headers.get("x-local-dvr-onboarding-token"), process.env.LOCAL_DVR_ONBOARDING_TOKEN)) {
      return fail("Forbidden", 403);
    }

    const payload = localDvrOnboardingSchema.parse(await request.json());
    if (!isLocalGatewayUrl(payload.gateway_url)) {
      return fail("Local onboarding only accepts a localhost Gateway URL.", 422);
    }

    const { gateway_url, gateway_secret, ...connection } = payload;
    return ok(await createDvrConnection(connection, { gatewayUrl: gateway_url, gatewaySecret: gateway_secret }), 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
