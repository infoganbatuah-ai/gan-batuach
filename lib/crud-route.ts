import { type ZodSchema } from "zod";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import type { Permission } from "@/lib/roles";
import { encryptField, getCurrentKeyVersion, hashForLookup } from "@/lib/security/field-encryption";
import { buildMaskedConnectionSummary } from "@/lib/domain/camera-connection-builder";

type CrudConfig = {
  table: string;
  read: Permission;
  write: Permission;
  schema?: ZodSchema;
  defaultOrder?: string;
  publicInsert?: boolean;
};

function debugLogsEnabled() {
  return process.env.NODE_ENV !== "production";
}

function hasSensitiveValue(...values: unknown[]) {
  return values.some((value) => typeof value === "string" ? Boolean(value.trim()) : value !== null && value !== undefined);
}

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
            ? "id,garden_id,kindergarten_id,name,area,age_group,class_group,camera_type,source_type,source_category,camera_zone_label,system_type,deployment_scope,test_site_type,camera_provider_key,gateway_provider_preference,live_preview_status,clip_readiness_status,snapshot_readiness_status,permission_model,stream_status,health_status,last_seen,connection_method,protocol,host,port,channel,connection_host,connection_port,connection_channel,stream_quality,last_test_status,last_test_message,last_test_at,gateway_registration_status,gateway_last_error,masked_connection_summary,hls_playback_url,sample_hls_url,webrtc_playback_url,video_gateway_stream_id,gateway_stream_id,viewing_hours,operating_hours,parent_view_allowed,parent_viewing_allowed,parent_visibility_status,parent_blocked_reason,staff_view_allowed,inspector_view_allowed,inspector_access_policy,status,active,ai_enabled,observer_enabled,observer_review_required,observer_confidence_threshold,last_health_check_at,last_successful_connection_at,last_stream_activity_at,uptime_seconds,failure_count,reconnect_attempts,recording_enabled,retention_days,archive_policy,created_at,updated_at"
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
        if (config.table === "camera_streams" && debugLogsEnabled()) console.info("Camera streams listed", { count: data?.length ?? 0, gardenId: gardenId ?? "all" });
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
        if (config.table === "children") {
          const medicalSensitive = hasSensitiveValue(parsed.allergies, parsed.medical_notes, parsed.regular_medications, parsed.sensitivities);
          insertPayload = {
            ...insertPayload,
            identity_number_encrypted: encryptField(parsed.identity_number),
            identity_number_hash: hashForLookup(parsed.identity_number),
            mother_identity_number_encrypted: encryptField(parsed.mother_identity_number),
            mother_identity_number_hash: hashForLookup(parsed.mother_identity_number),
            father_identity_number_encrypted: encryptField(parsed.father_identity_number),
            father_identity_number_hash: hashForLookup(parsed.father_identity_number),
            allergies_encrypted: encryptField(parsed.allergies),
            sensitivities_encrypted: encryptField(parsed.sensitivities),
            medical_notes_encrypted: encryptField(parsed.medical_notes),
            regular_medications_encrypted: encryptField(parsed.regular_medications),
            medical_encryption_status: medicalSensitive ? "encrypted" : "not_required",
            medical_encrypted_at: medicalSensitive ? new Date().toISOString() : null,
            encryption_version: getCurrentKeyVersion()
          };
        }
        if (config.table === "child_health_records") {
          insertPayload = {
            ...insertPayload,
            allergies_encrypted: encryptField(parsed.allergies),
            sensitivities_encrypted: encryptField(parsed.sensitivities),
            regular_medications_encrypted: encryptField(parsed.regular_medications),
            medications_encrypted: encryptField(parsed.medications),
            medical_notes_encrypted: encryptField(parsed.medical_notes),
            emergency_contacts_encrypted: encryptField(parsed.emergency_contacts),
            medication_approval_url_encrypted: encryptField(parsed.medication_approval_url),
            encryption_status: "encrypted",
            encrypted_at: new Date().toISOString(),
            encryption_version: getCurrentKeyVersion()
          };
        }
        if (config.table === "medicine_given_logs") {
          insertPayload = {
            ...insertPayload,
            medicine_name_encrypted: encryptField(parsed.medicine_name),
            dosage_encrypted: encryptField(parsed.dosage),
            notes_encrypted: encryptField(parsed.notes),
            encryption_status: "encrypted",
            encrypted_at: new Date().toISOString(),
            encryption_version: getCurrentKeyVersion()
          };
        }
        if (config.table === "camera_streams") {
          const cameraPayload = { ...parsed } as Record<string, unknown>;
          const rawPassword = typeof cameraPayload.password === "string" ? cameraPayload.password : "";
          const rawUsername = typeof cameraPayload.username === "string" ? cameraPayload.username : "";
          delete cameraPayload.password;
          delete cameraPayload.manual_rtsp_url;
          if (rawPassword) {
            const encrypted = encryptField(rawPassword);
            cameraPayload.encrypted_password = encrypted;
            cameraPayload.password_encrypted = encrypted;
            cameraPayload.connection_password_encrypted = encrypted;
            cameraPayload.secret_ref = `camera_streams:${crypto.randomUUID()}`;
          }
          if (rawUsername) cameraPayload.connection_username_encrypted = encryptField(rawUsername);
          const systemType = String(cameraPayload.system_type ?? cameraPayload.source_type ?? cameraPayload.camera_type ?? "manual_rtsp");
          const connectionHost = String(cameraPayload.connection_host ?? cameraPayload.host ?? "");
          const connectionPort = cameraPayload.connection_port ?? cameraPayload.port;
          const connectionChannel = cameraPayload.connection_channel ?? cameraPayload.channel;
          const testSiteType = String(cameraPayload.test_site_type ?? "");
          cameraPayload.system_type = systemType;
          cameraPayload.camera_provider_key = cameraPayload.camera_provider_key ?? (["hikvision", "dahua", "uniview", "axis"].includes(systemType) ? systemType : systemType === "ip_camera" ? "ip_camera" : systemType === "dvr" || systemType === "dvr_nvr" ? "dvr" : systemType === "nvr" ? "nvr" : "generic_camera");
          cameraPayload.deployment_scope = testSiteType || cameraPayload.deployment_scope || "kindergarten_production";
          cameraPayload.test_site_type = testSiteType || null;
          cameraPayload.gateway_provider_preference = cameraPayload.gateway_provider_preference ?? process.env.VIDEO_GATEWAY_PROVIDER ?? "custom";
          cameraPayload.live_preview_status = cameraPayload.live_preview_status ?? (cameraPayload.gateway_stream_id || cameraPayload.video_gateway_stream_id || cameraPayload.sample_hls_url || cameraPayload.hls_playback_url ? "ready" : "pending_gateway");
          cameraPayload.clip_readiness_status = cameraPayload.clip_readiness_status ?? "not_configured";
          cameraPayload.snapshot_readiness_status = cameraPayload.snapshot_readiness_status ?? "not_configured";
          cameraPayload.permission_model = cameraPayload.permission_model ?? "scoped_playback_token";
          cameraPayload.security_review = { rtsp_exposed: false, credentials_browser_exposed: false, gateway_secret_browser_exposed: false };
          cameraPayload.connection_host = connectionHost || null;
          cameraPayload.connection_port = connectionPort ? Number(connectionPort) : null;
          cameraPayload.connection_channel = connectionChannel ? Number(connectionChannel) : null;
          cameraPayload.stream_quality = cameraPayload.stream_quality ?? "sub";
          cameraPayload.masked_connection_summary = buildMaskedConnectionSummary({
            system_type: systemType === "DVR" || systemType === "dvr" || systemType === "NVR" || systemType === "nvr" || systemType === "dvr_nvr" ? "dvr_nvr" : systemType === "ONVIF" || systemType === "onvif" ? "onvif" : systemType === "Sample HLS" || systemType === "sample_hls" ? "sample_hls" : systemType === "ip_camera" || systemType === "hikvision" || systemType === "dahua" || systemType === "uniview" || systemType === "axis" || systemType === "generic_camera" || systemType === "rtsp" ? systemType as any : "manual_rtsp",
            host: connectionHost,
            port: connectionPort ? Number(connectionPort) : undefined,
            username: rawUsername,
            password: rawPassword,
            channel: connectionChannel ? Number(connectionChannel) : undefined,
            stream_quality: cameraPayload.stream_quality === "main" ? "main" : "sub",
            sample_hls_url: String(cameraPayload.sample_hls_url ?? cameraPayload.hls_playback_url ?? "")
          });
          cameraPayload.kindergarten_id = cameraPayload.garden_id;
          cameraPayload.source_type = cameraPayload.source_type ?? cameraPayload.camera_type;
          cameraPayload.source_url = "";
          cameraPayload.sample_hls_url = cameraPayload.sample_hls_url ?? cameraPayload.hls_playback_url;
          cameraPayload.gateway_stream_id = cameraPayload.gateway_stream_id ?? cameraPayload.video_gateway_stream_id;
          cameraPayload.parent_viewing_allowed = cameraPayload.parent_viewing_allowed ?? cameraPayload.parent_view_allowed;
          cameraPayload.stream_status = cameraPayload.stream_status ?? cameraPayload.status ?? "pending";
          cameraPayload.health_status = cameraPayload.health_status ?? (cameraPayload.status === "connected" ? "healthy" : "pending");
          cameraPayload.connection_method = cameraPayload.connection_method ?? (cameraPayload.gateway_stream_id || cameraPayload.video_gateway_stream_id ? "video_gateway" : "pending_gateway");
          cameraPayload.gateway_registration_status = cameraPayload.gateway_registration_status ?? (cameraPayload.connection_method === "video_gateway" ? "registered" : "pending_gateway");
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
            "health_summary",
            "source_category",
            "camera_zone_label",
            "operating_hours",
            "parent_visibility_status",
            "parent_blocked_reason",
            "staff_view_allowed",
            "inspector_view_allowed",
            "inspector_access_policy",
            "observer_enabled",
            "observer_review_required",
            "observer_confidence_threshold",
            "observer_zone_mapping",
            "safety_indicator_categories",
            "privacy_policy",
            "system_type",
            "connection_host",
            "connection_port",
            "connection_channel",
            "stream_quality",
            "connection_username_encrypted",
            "connection_password_encrypted",
            "rtsp_template",
            "last_test_status",
            "last_test_message",
            "last_test_at",
            "gateway_registration_status",
            "gateway_last_error",
            "masked_connection_summary",
            "deployment_scope",
            "test_site_type",
            "camera_provider_key",
            "gateway_provider_preference",
            "live_preview_status",
            "clip_readiness_status",
            "snapshot_readiness_status",
            "permission_model",
            "security_review"
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
          const safePriority = ["low", "medium", "high", "critical"].includes(String(parsed.priority)) ? String(parsed.priority) : "medium";
          const safeRole = ["admin", "inspector", "manager", "owner", "staff", "parent"].includes(String(parsed.assigned_role)) ? String(parsed.assigned_role) : null;
          const workflowType = ["inspection", "compliance", "incident", "complaint", "document_renewal", "communication", "onboarding", "observer_alert"].includes(String(parsed.task_type))
            ? String(parsed.task_type)
            : String(parsed.task_type) === "ai_event"
              ? "ai_recommendation"
              : "general";
          const workflowInsert = await (supabase as any).from("workflows").insert({
            garden_id: parsed.garden_id ?? null,
            assigned_role: safeRole,
            assigned_to: parsed.assigned_to ?? null,
            created_by: "session" in permission ? permission.session.profile.id : null,
            workflow_type: workflowType,
            title: parsed.title,
            summary: parsed.description ?? null,
            trigger_type: "manual_task",
            source_entity_type: "tasks",
            source_entity_id: data.id,
            priority: safePriority,
            status: "active",
            sla_due_at: parsed.due_at ?? null,
            metadata: { source: "api_tasks_create" }
          }).select("id").single();
          if (!workflowInsert.error && workflowInsert.data?.id) {
            const responseTarget = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const completionTarget = parsed.due_at || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
            const escalationTarget = parsed.due_at ? new Date(new Date(parsed.due_at).getTime() + 24 * 60 * 60 * 1000).toISOString() : new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString();
            const workflowTaskInsert = await (supabase as any).from("workflow_tasks").insert({
              workflow_id: workflowInsert.data.id,
              legacy_task_id: data.id,
              garden_id: parsed.garden_id ?? null,
              assigned_role: safeRole,
              assigned_to: parsed.assigned_to ?? null,
              created_by: "session" in permission ? permission.session.profile.id : null,
              task_type: parsed.task_type ?? "general",
              title: parsed.title,
              description: parsed.description ?? null,
              priority: safePriority,
              status: data.status ?? "open",
              due_at: parsed.due_at ?? null,
              response_target_at: responseTarget,
              completion_target_at: completionTarget,
              escalation_target_at: escalationTarget,
              source_entity_type: "tasks",
              source_entity_id: data.id,
              metadata: { source: "api_tasks_create" }
            }).select("id").single();
            if (!workflowTaskInsert.error && workflowTaskInsert.data?.id) {
              await (supabase as any).from("tasks").update({
                workflow_id: workflowInsert.data.id,
                workflow_task_id: workflowTaskInsert.data.id,
                response_target_at: responseTarget,
                completion_target_at: completionTarget,
                escalation_target_at: escalationTarget
              }).eq("id", data.id);
            }
          }
        }
        if (config.table === "camera_streams" && data && debugLogsEnabled()) {
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
            after_data: { name: data.name, status: data.status, camera_type: data.camera_type, deployment_scope: data.deployment_scope, test_site_type: data.test_site_type, parent_view_allowed: data.parent_view_allowed, ai_enabled: data.ai_enabled }
          });
          await (supabase as any).from("camera_deployment_audit_logs").insert({
            actor_id: permission.session.profile.id,
            actor_role: permission.session.profile.role,
            garden_id: data.garden_id ?? parsed.garden_id ?? null,
            camera_id: data.id,
            action: "create_camera_deployment_source",
            status: "logged",
            gateway_provider: data.gateway_provider_preference ?? process.env.VIDEO_GATEWAY_PROVIDER ?? "custom",
            validation_status: data.last_test_status ?? "not_tested",
            no_secrets_exposed: true,
            metadata: { deployment_scope: data.deployment_scope ?? null, test_site_type: data.test_site_type ?? null }
          });
          await (supabase as any).from("camera_infrastructure_audit_logs").insert({
            actor_id: permission.session.profile.id,
            actor_role: permission.session.profile.role,
            garden_id: data.garden_id ?? parsed.garden_id ?? null,
            camera_id: data.id,
            action: "camera_created",
            status: "success",
            no_secrets_exposed: true,
            after_data: {
              name: data.name,
              status: data.status,
              source_category: data.source_category ?? null,
              parent_visibility_status: data.parent_visibility_status ?? null,
              staff_view_allowed: data.staff_view_allowed ?? false,
              observer_enabled: data.observer_enabled ?? false
            }
          });
        }
        if (config.table === "camera_streams" && data) {
          const { password, password_encrypted, encrypted_password, secret_ref, username_encrypted, dvr_host_encrypted, connection_username_encrypted, connection_password_encrypted, source_url, ...safeCamera } = data as Record<string, unknown>;
          return ok(safeCamera, 201);
        }
        return ok(data, 201);
      } catch (error) {
        return handleRouteError(error);
      }
    }
  };
}
