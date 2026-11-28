import { createPrivateKey } from "node:crypto";
import { registerQaCameraPilotStop } from "@/lib/management/camera-pilot-logout";
import { createClient } from "@/lib/supabase/server";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createCameraPilotLoopbackTransport, createCameraPilotWindow, isCameraPilotSameOrigin } from "@/lib/management/camera-pilot-grant.mjs";

export const runtime = "nodejs";

const identifier = /^[A-Za-z0-9_-]{1,128}$/;
let pilot;

function unavailable() {
  return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

async function currentSession() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const claims = await client.auth.getClaims();
  const sessionId = claims.data?.claims.session_id;
  if (claims.error || claims.data?.claims.sub !== user.id ||
      typeof sessionId !== "string" || !identifier.test(sessionId)) return null;
  return { client, user, sessionId };
}

function getPilot() {
  if (process.env.NODE_ENV !== "development" || process.env.INTEGRATION_DEVELOPMENT !== "true" ||
      process.env.INTEGRATION_BACKEND !== "LOCAL_SUPABASE" ||
      process.env.GAN_CAMERA_PILOT_QA !== "1") return null;
  if (pilot) return pilot;
  const {
    GAN_CAMERA_PILOT_GARDEN: gardenId, GAN_CAMERA_PILOT_SITE: siteId,
    GAN_CAMERA_PILOT_CAMERA: cameraId, GAN_CAMERA_PILOT_VIEWER: viewerId,
    GAN_CAMERA_PILOT_ORIGIN: origin, GAN_CAMERA_PILOT_SERVICE_TOKEN: serviceToken,
    GAN_CAMERA_PILOT_SIGNING_KEY: signingKey
  } = process.env;
  if (![gardenId, siteId, cameraId, viewerId].every(value => typeof value === "string" && identifier.test(value)) ||
      !signingKey) return null;
  const transport = createCameraPilotLoopbackTransport({ origin, serviceToken });
  if (!transport) return null;
  try {
    const privateKey = createPrivateKey(signingKey);
    if (privateKey.asymmetricKeyType !== "ed25519") return null;
    pilot = createCameraPilotWindow({
      config: { environment: "development", qaGardenId: gardenId, privateKey }, transport,
      async resolveContext() {
        const session = await currentSession();
        if (!session || session.user.id !== viewerId) return null;
        const access = await getManagementGardenContext();
        if (!access.allowed || access.gardenId !== gardenId || access.session.user.id !== viewerId ||
            access.session.profile.role !== "manager") return null;
        const camera = await session.client.from("camera_streams").select("id,garden_id,active")
          .eq("id", cameraId).eq("garden_id", gardenId).eq("active", true).maybeSingle();
        if (camera.error || !camera.data) return null;
        return { sessionId: session.sessionId,
          viewer: { id: viewerId, role: "manager", active: true },
          camera: { id: cameraId, gardenId, siteId, active: true } };
      }
    });
    registerQaCameraPilotStop(sessionId => pilot.stop(sessionId));
    return pilot;
  } catch {
    return null;
  }
}

export async function POST(request) {
  if (!isCameraPilotSameOrigin(request)) return unavailable();
  const window = getPilot();
  if (!window) return unavailable();
  const answer = await window.start(request);
  return answer ? new Response(answer, { status: 201, headers: {
    "Content-Type": "application/sdp", "Cache-Control": "private, no-store"
  } }) : unavailable();
}

export async function DELETE(request) {
  if (!isCameraPilotSameOrigin(request)) return unavailable();
  try {
    const window = getPilot();
    if (!window) return unavailable();
    const session = await currentSession();
    if (!session || !await window.stop(session.sessionId)) return unavailable();
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return unavailable();
  }
}
