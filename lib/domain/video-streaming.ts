import crypto from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { canParentViewCamera, getCameraGardenId } from "@/lib/domain/parent-camera-access";
import { getGatewayProvider, getPlaybackUrls } from "@/lib/domain/video-gateway-client";
import type { UserRole } from "@/lib/roles";

export const playbackTokenSchema = z.object({
  parent_id: z.string().uuid().optional(),
  protocol: z.enum(["HLS", "WebRTC"]).default("HLS"),
  access_reason: z.string().max(160).optional()
});

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function cameraDebugLogsEnabled() {
  return process.env.NODE_ENV !== "production";
}

function parseViewingWindow(camera: Record<string, any>) {
  const policy = camera.operating_hours ?? camera.viewing_hours;
  const windowText = typeof policy === "string" ? policy : typeof policy?.window === "string" ? policy.window : null;
  if (!windowText || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(windowText)) return { allowed: true, reason: null };
  const [start, end] = windowText.split("-");
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const allowed = startMinutes <= endMinutes
    ? current >= startMinutes && current <= endMinutes
    : current >= startMinutes || current <= endMinutes;
  return { allowed, reason: allowed ? null : "מחוץ לשעות הצפייה" };
}

export async function createCameraPlaybackSession(cameraStreamId: string, payload: z.infer<typeof playbackTokenSchema>) {
  const parsed = playbackTokenSchema.parse(payload);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role, garden_id").eq("id", user.id).single();
  if (profileError || !profile) throw new Error(profileError?.message ?? "Profile not found");

  const dataSupabase = isAdminClientConfigured() ? createAdminClient() : supabase;
  const { data: camera, error: cameraError } = await dataSupabase.from("camera_streams").select("*").eq("id", cameraStreamId).single();
  if (cameraError || !camera) throw new Error(cameraError?.message ?? "Camera not found");

  const profileRow = profile as any;
  const cameraRow = camera as any;
  const cameraGardenId = getCameraGardenId(cameraRow);
  if (!cameraGardenId) throw new Error("Camera is missing kindergarten assignment");
  const role = profileRow.role as UserRole;
  const hours = parseViewingWindow(cameraRow);
  if (!hours.allowed) throw new Error(hours.reason ?? "המצלמה אינה זמינה כרגע");
  if (role === "parent") {
    const decision = await canParentViewCamera(dataSupabase as any, profileRow.id, cameraStreamId);
    const requestedParentIsCurrentUser = parsed.parent_id ? decision.diagnostics.parent_records_found.some((parent: any) => parent.id === parsed.parent_id) : true;
    if (cameraDebugLogsEnabled()) {
      console.info("Parent playback permission check", { cameraStreamId, requestedParentId: parsed.parent_id ?? null, allowed: decision.allowed && requestedParentIsCurrentUser, reason: decision.reason, diagnostics: decision.diagnostics });
    }
    if (!decision.allowed || !requestedParentIsCurrentUser) throw new Error("אין הרשאת צפייה למצלמה זו");
  }

  if (role === "manager" || role === "owner" || role === "staff") {
    if (profileRow.garden_id !== cameraGardenId) throw new Error("Camera is not assigned to your kindergarten");
    if (role === "staff" && cameraRow.staff_view_allowed !== true) throw new Error("הצפייה לצוות לא נפתחה על ידי מנהלת הגן");
  }

  if (role === "inspector") {
    if (cameraRow.inspector_view_allowed === false || cameraRow.inspector_access_policy === "disabled") throw new Error("גישה לפקח אינה מאושרת למצלמה זו");
    if (cameraRow.inspector_access_policy === "assigned_garden_with_reason" && !parsed.access_reason) throw new Error("נדרשת סיבת צפייה לצורכי פיקוח");
    const { data: garden, error } = await supabase.from("gardens" as any).select("id").eq("id", cameraGardenId).eq("inspector_id", user.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!garden) throw new Error("Camera is not assigned to your inspected kindergartens");
  }

  if (role !== "admin" && role !== "inspector" && role !== "manager" && role !== "owner" && role !== "parent" && role !== "staff") {
    throw new Error("Role is not allowed to view cameras");
  }

  const token = createToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const baseUrl = parsed.protocol === "WebRTC" ? cameraRow.webrtc_playback_url : (cameraRow.hls_playback_url ?? cameraRow.sample_hls_url);
  const gatewayStreamId = cameraRow.gateway_stream_id ?? cameraRow.video_gateway_stream_id ?? cameraStreamId;
  const gatewayBase = process.env.VIDEO_GATEWAY_URL;
  if (!baseUrl && !gatewayBase) throw new Error("Video gateway is not connected yet");
  let playbackUrl = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}token=${token}` : "";
  if (!playbackUrl) {
    const gatewayPlayback = await getPlaybackUrls(gatewayStreamId, token);
    playbackUrl = parsed.protocol === "WebRTC" ? gatewayPlayback.playback.webrtc_url : gatewayPlayback.playback.hls_url;
  }

  const { data: session, error: sessionError } = await supabase
    .from("video_stream_sessions")
    .insert({
      garden_id: cameraGardenId,
      camera_stream_id: cameraStreamId,
      viewer_id: user.id,
      viewer_role: role,
      parent_id: parsed.parent_id,
      playback_protocol: parsed.protocol,
      token_hash: sha256(token),
      token_expires_at: expiresAt,
      playback_url: playbackUrl
    } as any)
    .select("*")
    .single();

  if (sessionError) throw new Error(sessionError.message);

  await supabase.from("camera_playback_sessions" as any).insert({
    profile_id: user.id,
    camera_id: cameraStreamId,
    kindergarten_id: cameraGardenId,
    playback_protocol: parsed.protocol,
    gateway_provider: getGatewayProvider(),
    token_hash: sha256(token),
    ip: null,
    user_agent: null,
    metadata: { legacy_video_stream_session_id: (session as any).id, no_rtsp_exposed: true }
  } as any);

  await supabase.from("camera_view_logs").insert({
    camera_stream_id: cameraStreamId,
    garden_id: cameraGardenId,
    viewer_id: user.id,
    viewer_role: role,
    token_hash: sha256(token)
  } as any);

  await supabase.from("camera_infrastructure_audit_logs" as any).insert({
    camera_id: cameraStreamId,
    garden_id: cameraGardenId,
    actor_id: user.id,
    actor_role: role,
    action: `${role}_viewing_token_created`,
    status: "success",
    no_secrets_exposed: true,
    metadata: {
      protocol: parsed.protocol,
      parent_id: parsed.parent_id ?? null,
      access_reason: parsed.access_reason ?? null,
      token_expires_at: expiresAt,
      source: "playback_token"
    }
  });

  return { token, expires_at: expiresAt, playback_url: playbackUrl, session };
}

export async function endCameraPlaybackSession(sessionId: string) {
  const supabase = await createClient();
  const endedAt = new Date().toISOString();
  const { data: session, error } = await supabase
    .from("video_stream_sessions")
    .update({ ended_at: endedAt } as any)
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return session;
}
