import { type ZodSchema } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import type { Permission } from "@/lib/roles";

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
        let query = (supabase as any).from(config.table).select("*").limit(Math.min(limit, 200));
        if (gardenId) query = query.eq("garden_id", gardenId);
        if (config.defaultOrder) query = query.order(config.defaultOrder, { ascending: false });
        const { data, error } = await query;
        if (error) return fail(error.message, 400);
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
        const insertPayload = config.table === "messages" && "session" in permission
          ? { ...parsed, sender_id: permission.session.profile.id, content: parsed.content ?? parsed.body }
          : parsed;
        const supabase = await createClient();
        const { data, error } = await (supabase as any).from(config.table).insert(insertPayload).select("*").single();
        if (error) return fail(error.message, 400);
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
        return ok(data, 201);
      } catch (error) {
        return handleRouteError(error);
      }
    }
  };
}
