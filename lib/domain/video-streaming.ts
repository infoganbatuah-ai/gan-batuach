import crypto from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { canParentViewCamera, getCameraGardenId } from "@/lib/domain/parent-camera-access";
import { getGatewayProvider, getPlaybackUrls } from "@/lib/domain/video-gateway-client";
import type { UserRole } from "@/lib/roles";
import { getMfaGateStatus } from "@/lib/security/identity-security";

export const playbackTokenSchema = z.object({
  parent_id: z.string().uuid().optional(),
  protocol: z.enum(["HLS", "WebRTC"]).default("WebRTC"),
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

function parseViewingWindow(input: Record<string, any> | null | undefined) {
  const policy = input?.viewing_hours ?? input?.operating_hours;
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

function maskPhone(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `***${digits.slice(-4)}`;
}

async function recordCameraAuthorizationCheck(supabase: any, payload: Record<string, any>) {
  await supabase.from("camera_viewing_authorization_checks" as any).insert({
    check_key: `${payload.check_type}:${payload.camera_id ?? "camera"}:${payload.profile_id ?? "profile"}:${Date.now()}:${crypto.randomBytes(4).toString("hex")}`,
    ...payload
  });
}

async function recordCameraAccessAudit(supabase: any, payload: Record<string, any>) {
  await supabase.from("camera_access_audit_trail" as any).insert(payload);
}

export async function createCameraPlaybackSession(cameraStreamId: string, payload: z.infer<typeof playbackTokenSchema>, requestMeta: { ip?: string | null; userAgent?: string | null } = {}) {
  const parsed = playbackTokenSchema.parse(payload);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role, garden_id, full_name, phone, email").eq("id", user.id).single();
  if (profileError || !profile) throw new Error(profileError?.message ?? "Profile not found");

  const dataSupabase = isAdminClientConfigured() ? createAdminClient() : supabase;
  const { data: camera, error: cameraError } = await dataSupabase.from("camera_streams").select("*").eq("id", cameraStreamId).single();
  if (cameraError || !camera) throw new Error(cameraError?.message ?? "Camera not found");

  const profileRow = profile as any;
  const cameraRow = camera as any;
  const cameraGardenId = getCameraGardenId(cameraRow);
  if (!cameraGardenId) throw new Error("Camera is missing kindergarten assignment");
  const role = profileRow.role as UserRole;
  const cameraHours = parseViewingWindow(cameraRow);
  if (!cameraHours.allowed) throw new Error(cameraHours.reason ?? "המצלמה אינה זמינה כרגע");
  let selectedChildId: string | null = null;
  let parentPolicy: any = null;
  if (role === "parent") {
    if (parsed.protocol !== "WebRTC") throw new Error("צפיית הורים זמינה דרך WebRTC מאובטח בלבד");
    const policyResult = await dataSupabase
      .from("parent_camera_policies" as any)
      .select("*")
      .eq("garden_id", cameraGardenId)
      .eq("status", "active")
      .maybeSingle();
    parentPolicy = policyResult.data ?? null;
    if (policyResult.error) throw new Error(policyResult.error.message);
    if (!parentPolicy || parentPolicy.viewing_enabled !== true) {
      await recordCameraAccessAudit(supabase, {
        garden_id: cameraGardenId,
        camera_id: cameraStreamId,
        profile_id: user.id,
        viewer_role: role,
        action: "view_blocked",
        status: "blocked",
        ip: requestMeta.ip ?? null,
        user_agent: requestMeta.userAgent ?? null,
        metadata: { reason: "parent_policy_disabled_or_missing" }
      });
      throw new Error("הגן עדיין לא פתח צפייה להורים במדיניות מאושרת");
    }
    if (Array.isArray(parentPolicy.approved_camera_ids) && parentPolicy.approved_camera_ids.length && !parentPolicy.approved_camera_ids.includes(cameraStreamId)) {
      await recordCameraAuthorizationCheck(supabase, { garden_id: cameraGardenId, camera_id: cameraStreamId, profile_id: user.id, check_type: "camera_approved", status: "failed", reason: "camera_not_in_approved_policy_list" });
      throw new Error("מצלמה זו לא אושרה לצפיית הורים");
    }
    const policyHours = parseViewingWindow(parentPolicy);
    if (!policyHours.allowed) {
      await recordCameraAuthorizationCheck(supabase, { garden_id: cameraGardenId, camera_id: cameraStreamId, profile_id: user.id, check_type: "viewing_window", status: "failed", reason: policyHours.reason });
      throw new Error(policyHours.reason ?? "מחוץ לשעות הצפייה");
    }
    const mfaGate = await getMfaGateStatus(dataSupabase, { id: user.id, role }, "camera_view");
    await recordCameraAuthorizationCheck(supabase, { garden_id: cameraGardenId, camera_id: cameraStreamId, profile_id: user.id, check_type: "mfa_enabled", status: mfaGate.allowed ? "passed" : "failed", reason: mfaGate.reason });
    if (!mfaGate.allowed) throw new Error(mfaGate.reason === "fresh_mfa_required" ? "נדרש אימות נוסף לפני צפייה במצלמות." : "נדרש להפעיל אימות נוסף לפני צפייה במצלמות.");

    const decision = await canParentViewCamera(dataSupabase as any, profileRow.id, cameraStreamId);
    const requestedParentIsCurrentUser = parsed.parent_id ? decision.diagnostics.parent_records_found.some((parent: any) => parent.id === parsed.parent_id) : true;
    if (cameraDebugLogsEnabled()) {
      console.info("Parent playback permission check", { cameraStreamId, requestedParentId: parsed.parent_id ?? null, allowed: decision.allowed && requestedParentIsCurrentUser, reason: decision.reason, diagnostics: decision.diagnostics });
    }
    if (!decision.allowed || !requestedParentIsCurrentUser) throw new Error("אין הרשאת צפייה למצלמה זו");
    await recordCameraAuthorizationCheck(supabase, { garden_id: cameraGardenId, camera_id: cameraStreamId, profile_id: user.id, parent_id: parsed.parent_id ?? null, check_type: "parent_verified", status: "passed" });

    const linkedChildIds = decision.diagnostics.linked_children_found
      .filter((child: any) => (child.garden_id ?? child.kindergarten_id) === cameraGardenId)
      .map((child: any) => child.id)
      .filter(Boolean);
    if (!linkedChildIds.length) {
      await recordCameraAuthorizationCheck(supabase, { garden_id: cameraGardenId, camera_id: cameraStreamId, profile_id: user.id, parent_id: parsed.parent_id ?? null, check_type: "child_enrolled", status: "failed", reason: "no_linked_child_for_camera_garden" });
      throw new Error("נדרשת הרשאת ילד פעיל בגן");
    }
    await recordCameraAuthorizationCheck(supabase, { garden_id: cameraGardenId, camera_id: cameraStreamId, profile_id: user.id, parent_id: parsed.parent_id ?? null, child_id: linkedChildIds[0], check_type: "child_enrolled", status: "passed" });
    const attendanceResult = await dataSupabase
      .from("attendance" as any)
      .select("child_id,status,check_in_at,check_out_at")
      .eq("garden_id", cameraGardenId)
      .in("child_id", linkedChildIds)
      .eq("attendance_date", new Date().toISOString().slice(0, 10))
      .order("updated_at", { ascending: false })
      .limit(20);
    if (attendanceResult.error) throw new Error(attendanceResult.error.message);
    const present = (attendanceResult.data ?? []).find((row: any) => row.status === "present" && row.check_in_at && !row.check_out_at);
    await recordCameraAuthorizationCheck(supabase, { garden_id: cameraGardenId, camera_id: cameraStreamId, profile_id: user.id, parent_id: parsed.parent_id ?? null, child_id: present?.child_id ?? linkedChildIds[0], check_type: "child_present", status: present ? "passed" : "failed", reason: present ? null : "child_not_checked_in_or_already_checked_out" });
    if (!present) throw new Error("הצפייה זמינה רק כאשר הילד נמצא בגן");
    selectedChildId = present.child_id;
    const roomLabel = cameraRow.class_group ?? cameraRow.age_group ?? cameraRow.camera_zone_label ?? null;
    if (roomLabel) {
      const childRoom = await dataSupabase
        .from("children" as any)
        .select("id,classroom,age_group")
        .eq("id", selectedChildId)
        .maybeSingle();
      if (childRoom.error) throw new Error(childRoom.error.message);
      const childLabels = [childRoom.data?.classroom, childRoom.data?.age_group].filter(Boolean).map((value) => String(value));
      const roomAllowed = !childLabels.length || childLabels.includes(String(roomLabel));
      await recordCameraAuthorizationCheck(supabase, { garden_id: cameraGardenId, camera_id: cameraStreamId, profile_id: user.id, parent_id: parsed.parent_id ?? null, child_id: selectedChildId, check_type: "child_present", status: roomAllowed ? "passed" : "failed", reason: roomAllowed ? null : "child_not_in_camera_room", metadata: { camera_room: roomLabel, child_labels: childLabels } });
      if (!roomAllowed) throw new Error("הצפייה זמינה רק למצלמה המשויכת לחדר של הילד בשעה זו");
    }
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
  const maxSessionMinutes = role === "parent"
    ? Math.min(Number(parentPolicy?.max_session_minutes ?? cameraRow.max_parent_session_minutes ?? 5), Number(cameraRow.max_parent_session_minutes ?? 5), 30)
    : 15;
  const expiresAt = new Date(Date.now() + maxSessionMinutes * 60 * 1000).toISOString();
  const baseUrl = parsed.protocol === "WebRTC" ? cameraRow.webrtc_playback_url : (cameraRow.hls_playback_url ?? cameraRow.sample_hls_url);
  const gatewayStreamId = cameraRow.gateway_stream_id ?? cameraRow.video_gateway_stream_id ?? cameraStreamId;
  const gatewayBase = process.env.VIDEO_GATEWAY_URL;
  if (!baseUrl && !gatewayBase) throw new Error("Video gateway is not connected yet");
  if (baseUrl && String(baseUrl).toLowerCase().startsWith("rtsp://")) throw new Error("Direct camera stream is not allowed");
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
      playback_url: playbackUrl,
      child_id: selectedChildId,
      watermark_text: role === "parent" ? `${profileRow.full_name ?? "Parent"} · ${maskPhone(profileRow.phone)} · ${requestMeta.ip ?? "IP"} · ${new Date().toLocaleString("he-IL")}` : null
    } as any)
    .select("*")
    .single();

  if (sessionError) throw new Error(sessionError.message);

  const watermarkText = role === "parent"
    ? `${profileRow.full_name ?? "Parent"} · ${maskPhone(profileRow.phone)} · ${requestMeta.ip ?? "IP"} · ${new Date().toLocaleString("he-IL")} · ${String(session.id).slice(0, 8)}`
    : `${role} · ${new Date().toLocaleString("he-IL")}`;
  const watermarkHash = sha256(watermarkText);
  const playbackSessionResult = await supabase.from("camera_playback_sessions" as any).insert({
    profile_id: user.id,
    camera_id: cameraStreamId,
    kindergarten_id: cameraGardenId,
    child_id: selectedChildId,
    parent_id: parsed.parent_id ?? null,
    playback_protocol: parsed.protocol,
    gateway_provider: getGatewayProvider(),
    token_hash: sha256(token),
    ip: requestMeta.ip ?? null,
    user_agent: requestMeta.userAgent ?? null,
    watermark_text: watermarkText,
    watermark_hash: watermarkHash,
    compliance_status: "success",
    metadata: {
      legacy_video_stream_session_id: (session as any).id,
      no_rtsp_exposed: true,
      dtls_srtp_required: parsed.protocol === "WebRTC",
      secure_webrtc_gateway_required: true,
      child_presence_required: role === "parent",
      mfa_required: role === "parent",
      expires_at: expiresAt
    }
  } as any).select("id").maybeSingle();
  if (playbackSessionResult.error) throw new Error(playbackSessionResult.error.message);

  await supabase.from("camera_view_logs").insert({
    camera_stream_id: cameraStreamId,
    garden_id: cameraGardenId,
    viewer_id: user.id,
    viewer_role: role,
    token_hash: sha256(token)
  } as any);

  await recordCameraAuthorizationCheck(supabase, { garden_id: cameraGardenId, camera_id: cameraStreamId, profile_id: user.id, parent_id: parsed.parent_id ?? null, child_id: selectedChildId, check_type: "token_issued", status: "passed", metadata: { expires_at: expiresAt, protocol: parsed.protocol } });
  await recordCameraAccessAudit(supabase, {
    session_id: (session as any).id,
    camera_playback_session_id: playbackSessionResult.data?.id ?? null,
    garden_id: cameraGardenId,
    camera_id: cameraStreamId,
    child_id: selectedChildId,
    parent_id: parsed.parent_id ?? null,
    profile_id: user.id,
    viewer_role: role,
    action: "token_created",
    status: "success",
    ip: requestMeta.ip ?? null,
    user_agent: requestMeta.userAgent ?? null,
    started_at: (session as any).started_at ?? new Date().toISOString(),
    watermark_hash: watermarkHash,
    metadata: { protocol: parsed.protocol, expires_at: expiresAt, no_direct_camera_exposure: true }
  });

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

  return {
    token,
    expires_at: expiresAt,
    playback_url: playbackUrl,
    session,
    watermark: {
      text: watermarkText,
      required: role === "parent" ? parentPolicy?.watermark_required !== false : false,
      anti_screenshot_required: role === "parent",
      anti_recording_notice_required: role === "parent"
    }
  };
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
