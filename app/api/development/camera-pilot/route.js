import { createPrivateKey } from "node:crypto";
import { registerQaCameraPilotStop } from "@/lib/management/camera-pilot-logout";
import { canUseSyntheticCameraPilot } from "@/lib/management/camera-pilot-role-policy";
import { createClient } from "@/lib/supabase/server";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createCameraPilotLoopbackTransport, createCameraPilotWindow, isCameraPilotSameOrigin, verifyCameraPilotParentScope } from "@/lib/management/camera-pilot-grant.mjs";

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
  return { client, user, sessionId, claims: claims.data.claims };
}

async function resolveContext({ viewerId, gardenId, cameraId, siteId }) {
  const session = await currentSession();
  if (!session || session.user.id !== viewerId) return null;
  const { client } = session;
  const profile = await client.from("profiles").select("id,role,active,garden_id").eq("id", viewerId).single();
  if (profile.error || profile.data?.active !== true ||
      !["manager", "staff", "parent"].includes(profile.data.role)) return null;
  const role = profile.data.role;
  const columns = role === "manager" ? "id,garden_id,active" :
    "id,garden_id,active,observer_site_id,parent_view_allowed,staff_view_allowed,class_group,age_group,camera_zone_label,viewing_hours,operating_hours";
  const camera = await client.from("camera_streams").select(columns)
    .eq("id", cameraId).eq("garden_id", gardenId).eq("active", true).maybeSingle();
  if (camera.error || !camera.data) return null;
  if (role === "manager") {
    const access = await getManagementGardenContext();
    if (!access.allowed || access.gardenId !== gardenId || access.session.user.id !== viewerId ||
        access.session.profile.role !== role) return null;
  } else if (!await canUseSyntheticCameraPilot(client, profile.data, session.claims, camera.data, siteId)) {
    return null;
  }
  return { sessionId: session.sessionId, viewer: { id: viewerId, role, active: true },
    camera: { id: cameraId, gardenId, siteId, active: true } };
}

function configuredPilot() {
  if (process.env.NODE_ENV !== "development" || process.env.INTEGRATION_DEVELOPMENT !== "true" ||
      process.env.INTEGRATION_BACKEND !== "LOCAL_SUPABASE" ||
      process.env.GAN_CAMERA_PILOT_QA !== "1") return null;
  const {
    GAN_CAMERA_PILOT_GARDEN: gardenId, GAN_CAMERA_PILOT_SITE: siteId,
    GAN_CAMERA_PILOT_CAMERA: cameraId, GAN_CAMERA_PILOT_VIEWER: viewerId,
    GAN_CAMERA_PILOT_ORIGIN: origin, GAN_CAMERA_PILOT_SERVICE_TOKEN: serviceToken,
    GAN_CAMERA_PILOT_SIGNING_KEY: signingKey
  } = process.env;
  if (![gardenId, siteId, cameraId, viewerId].every(value => typeof value === "string" && identifier.test(value)) ||
      !signingKey) return null;
  return { gardenId, siteId, cameraId, viewerId, origin, serviceToken, signingKey };
}

function getPilot() {
  const config = configuredPilot();
  if (!config) return null;
  if (pilot) return pilot;
  const { gardenId, siteId, cameraId, viewerId, origin, serviceToken, signingKey } = config;
  const transport = createCameraPilotLoopbackTransport({ origin, serviceToken });
  if (!transport) return null;
  try {
    const privateKey = createPrivateKey(signingKey);
    if (privateKey.asymmetricKeyType !== "ed25519") return null;
    pilot = createCameraPilotWindow({
      config: { environment: "development", qaGardenId: gardenId, privateKey }, transport,
      resolveContext: () => resolveContext({ viewerId, gardenId, cameraId, siteId })
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

// Called by the private loopback resolver, which separately verifies that the
// bound Auth session still exists. No grant or media capability is returned.
export async function PUT(request) {
  const config = configuredPilot();
  if (!config) return unavailable();
  const allowed = await verifyCameraPilotParentScope({
    request,
    config,
    token: process.env.GAN_CAMERA_PILOT_SCOPE_TOKEN,
    resolveContext: () => resolveContext(config)
  });
  return allowed ? new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } }) : unavailable();
}
