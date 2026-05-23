import crypto from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";

export const playbackTokenSchema = z.object({
  parent_id: z.string().uuid().optional(),
  protocol: z.enum(["HLS", "WebRTC"]).default("HLS")
});

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("base64url");
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

  const { data: camera, error: cameraError } = await supabase.from("camera_streams").select("*").eq("id", cameraStreamId).single();
  if (cameraError || !camera) throw new Error(cameraError?.message ?? "Camera not found");

  const profileRow = profile as any;
  const cameraRow = camera as any;
  const role = profileRow.role as UserRole;
  if (role === "parent") {
    if (!parsed.parent_id) throw new Error("Parent id is required for parent playback");
    const { data: allowed, error } = await supabase.rpc("can_parent_view_camera", {
      p_parent_id: parsed.parent_id,
      p_camera_stream_id: cameraStreamId
    } as any);
    if (error) throw new Error(error.message);
    if (!allowed) throw new Error("Parent is not allowed to view this camera");
  }

  if (role !== "admin" && role !== "inspector" && role !== "manager" && role !== "parent") {
    throw new Error("Role is not allowed to view cameras");
  }

  const token = createToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const playbackUrl =
    parsed.protocol === "WebRTC"
      ? `${cameraRow.webrtc_playback_url ?? "/api/video/webrtc"}/${cameraStreamId}?token=${token}`
      : `${cameraRow.hls_playback_url ?? "/api/video/hls"}/${cameraStreamId}/index.m3u8?token=${token}`;

  const { data: session, error: sessionError } = await supabase
    .from("video_stream_sessions")
    .insert({
      garden_id: cameraRow.garden_id,
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

  await supabase.from("camera_view_logs").insert({
    camera_stream_id: cameraStreamId,
      garden_id: cameraRow.garden_id,
    viewer_id: user.id,
    viewer_role: role,
    token_hash: sha256(token)
  } as any);

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
