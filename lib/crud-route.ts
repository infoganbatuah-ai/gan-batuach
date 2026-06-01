import { type ZodSchema } from "zod";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import type { Permission } from "@/lib/roles";
import { encryptField } from "@/lib/security/encryption";

type CrudConfig = {
  table: string;
  read: Permission;
  write: Permission;
  schema?: ZodSchema;
  defaultOrder?: string;
  publicInsert?: boolean;
};

export function createCrudHandlers(config: CrudConfig) {
  return {
    async GET(request: Request) {
      try {
        const permission = await requirePermission(config.read);
        if (!permission.allowed) return fail("Forbidden", 403);

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const limit = Number(searchParams.get("limit") ?? 50);
        const gardenId = searchParams.get("garden_id");
        const selectColumns =
          config.table === "camera_streams"
            ? "id,garden_id,kindergarten_id,name,area,age_group,class_group,camera_type,source_type,source_url,stream_status,health_status,last_seen,connection_method,protocol,host,port,username,rtsp_path,onvif_path,channel,hls_playback_url,sample_hls_url,webrtc_playback_url,video_gateway_stream_id,gateway_stream_id,viewing_hours,parent_view_allowed,parent_viewing_allowed,status,active,ai_enabled,last_health_check_at,last_successful_connection_at,last_stream_activity_at,uptime_seconds,failure_count,reconnect_attempts,recording_enabled,retention_days,archive_policy,created_at,updated_at"
            : "*";
        let query = (supabase as any).from(config.table).select(selectColumns).limit(Math.min(limit, 200));
        if (gardenId) query = query.eq("garden_id", gardenId);
        if (config.defaultOrder) query = query.order(config.defaultOrder, { ascending: false });
        let { data, error } = await query;
        if (error && config.table === "camera_streams") {
          console.error("Camera streams safe list query failed, retrying fallback:", error);
          const fallbackColumns = "id,garden_id,name,area,camera_type,protocol,status,active,parent_view_allowed,last_health_check_at,hls_playback_url,webrtc_playback_url,video_gateway_stream_id,viewing_hours,created_at,updated_at";
          let fallbackQuery = (supabase as any).from(config.table).select(fallbackColumns).limit(Math.min(limit, 200));
          if (gardenId) fallbackQuery = fallbackQuery.eq("garden_id", gardenId);
          if (config.defaultOrder) fallbackQuery = fallbackQuery.order(config.defaultOrder, { ascending: false });
          const fallback = await fallbackQuery;
          data = fallback.data;
          error = fallback.error;
        }
        if (error) return fail(error.message, 400);
        if (config.table === "camera_streams") console.info("Camera streams listed", { count: data?.length ?? 0, gardenId: gardenId ?? "all" });
        return ok(data);
      } catch (error) {
        return handleRouteError(error);
      }
    },

    async POST(request: Request) {
      try {
        const permission = config.publicInsert ? { allowed: true } : await requirePermission(config.write);
        if (!permission.allowed) return fail("Forbidden", 403);

        const payload = await request.json();
        const parsed = config.schema ? config.schema.parse(payload) : payload;
        let insertPayload = config.table === "messages" && "session" in permission
          ? { ...parsed, sender_id: permission.session.profile.id, content: parsed.content ?? parsed.body }
          : parsed;
        if (config.table === "camera_streams") {
          const cameraPayload = { ...parsed } as Record<string, unknown>;
          const rawPassword = typeof cameraPayload.password === "string" ? cameraPayload.password : "";
          delete cameraPayload.password;
          if (rawPassword) {
            const encrypted = encryptField(rawPassword);
            cameraPayload.encrypted_password = encrypted;
            cameraPayload.password_encrypted = encrypted;
            cameraPayload.secret_ref = `camera_streams:${crypto.randomUUID()}`;
          }
          cameraPayload.kindergarten_id = cameraPayload.garden_id;
          cameraPayload.source_type = cameraPayload.source_type ?? cameraPayload.camera_type;
          cameraPayload.source_url = cameraPayload.source_url ?? "";
          cameraPayload.sample_hls_url = cameraPayload.sample_hls_url ?? cameraPayload.hls_playback_url;
          cameraPayload.gateway_stream_id = cameraPayload.gateway_stream_id ?? cameraPayload.video_gateway_stream_id;
          cameraPayload.parent_viewing_allowed = cameraPayload.parent_viewing_allowed ?? cameraPayload.parent_view_allowed;
          cameraPayload.stream_status = cameraPayload.stream_status ?? cameraPayload.status ?? "pending";
          cameraPayload.health_status = cameraPayload.health_status ?? (cameraPayload.status === "connected" ? "healthy" : "pending");
          cameraPayload.connection_method = cameraPayload.connection_method ?? (cameraPayload.gateway_stream_id || cameraPayload.video_gateway_stream_id ? "video_gateway" : "pending_gateway");
          insertPayload = cameraPayload;
        }
        const supabase = await createClient();
        let { data, error } = await (supabase as any).from(config.table).insert(insertPayload).select("*").single();
        if (error && config.table === "camera_streams" && /column .* does not exist|schema cache/i.test(error.message ?? "")) {
          console.error("Camera stream insert with readiness fields failed, retrying legacy-safe payload:", error);
          const legacyPayload = { ...(insertPayload as Record<string, unknown>) };
          [
            "source_url",
            "stream_status",
            "health_status",
            "last_seen",
            "connection_method",
            "last_successful_connection_at",
            "last_stream_activity_at",
            "uptime_seconds",
            "failure_count",
            "reconnect_attempts",
            "recording_enabled",
            "retention_days",
            "archive_policy",
            "disabled_at",
            "disabled_by",
            "health_summary"
          ].forEach((key) => delete legacyPayload[key]);
          const legacyInsert = await (supabase as any).from(config.table).insert(legacyPayload).select("*").single();
          data = legacyInsert.data;
          error = legacyInsert.error;
        }
        if (error) return fail(error.message, 400);
        if (config.table === "messages" && data && parsed.recipient_id) {
          await (supabase as any).from("notifications").insert({
            garden_id: parsed.garden_id ?? null,
            recipient_id: parsed.recipient_id,
            recipient_role: null,
            title: "הודעה חדשה",
            body: parsed.subject,
            entity_type: "message",
            entity_id: data.id,
            status: "pending",
            metadata: { linked_child_id: parsed.linked_child_id ?? null }
          });
        }
        if (config.table === "tasks" && data) {
          const recipients = parsed.assigned_to ? [parsed.assigned_to] : [];
          await Promise.all(recipients.map((recipientId: string) => (supabase as any).from("notifications").insert({
            garden_id: parsed.garden_id ?? null,
            recipient_id: recipientId,
            recipient_role: parsed.assigned_role ?? null,
            title: "משימה חדשה",
            body: parsed.title,
            entity_type: "task",
            entity_id: data.id,
            severity: parsed.priority ?? "medium"
          })));
        }
        if (config.table === "camera_streams" && data) {
          console.info("Camera stream created", {
            id: data.id,
            kindergarten_id: data.kindergarten_id ?? data.garden_id,
            status: data.status,
            sample_hls_url_exists: Boolean(data.sample_hls_url ?? data.hls_playback_url)
          });
        }
        if (config.table === "camera_streams" && data && "session" in permission) {
          await (supabase as any).from("audit_logs").insert({
            actor_id: permission.session.profile.id,
            actor_role: permission.session.profile.role,
            garden_id: data.garden_id ?? parsed.garden_id ?? null,
            entity_type: "camera_streams",
            entity_id: data.id,
            action: "create_camera_source",
            after_data: { name: data.name, status: data.status, camera_type: data.camera_type, parent_view_allowed: data.parent_view_allowed, ai_enabled: data.ai_enabled }
          });
        }
        if (config.table === "camera_streams" && data) {
          const { password, password_encrypted, encrypted_password, secret_ref, username_encrypted, dvr_host_encrypted, ...safeCamera } = data as Record<string, unknown>;
          return ok(safeCamera, 201);
        }
        return ok(data, 201);
      } catch (error) {
        return handleRouteError(error);
      }
    }
  };
}
