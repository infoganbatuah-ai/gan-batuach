import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const incidentTypes = ["injury", "fall", "violence", "crying", "complaint", "staff_absence", "camera_issue", "safety_issue", "medical_issue", "parent_complaint"] as const;

const incidentSchema = z.object({
  garden_id: z.string().uuid(),
  child_id: z.string().uuid().optional(),
  incident_type: z.enum(incidentTypes),
  title: z.string().min(2),
  description: z.string().min(5),
  photo_urls: z.array(z.string()).default([]),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assigned_to: z.string().uuid().optional(),
  parent_notified: z.boolean().default(false),
  inspector_notified: z.boolean().default(false)
});

export async function GET(request: Request) {
  try {
    await requireRole(["admin", "manager", "owner", "staff", "parent", "inspector"]);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    let query = supabase.from("incident_reports" as any).select("*, children(full_name, photo_url), assignee:assigned_to(full_name), reporter:reported_by(full_name)").order("created_at", { ascending: false }).limit(100);
    const gardenId = searchParams.get("garden_id");
    if (gardenId) query = query.eq("garden_id", gardenId);
    const status = searchParams.get("status");
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      console.error("[incident-reports:get]", error);
      return fail("לא ניתן לטעון אירועים כרגע", 400);
    }
    return ok(data ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner", "staff", "parent", "inspector"]);
    const payload = incidentSchema.parse(await request.json());
    if (profile.role !== "admin" && profile.garden_id !== payload.garden_id) return fail("אין הרשאה לדווח אירוע בגן אחר", 403);
    const supabase = await createClient();
    const { data, error } = await supabase.from("incident_reports" as any).insert({
      ...payload,
      reported_by: profile.id,
      timeline: [{ at: new Date().toISOString(), by: profile.id, action: "created", status: "open" }]
    }).select("*").single();
    if (error) {
      console.error("[incident-reports:post]", error);
      return fail("לא ניתן לשמור אירוע כרגע", 400);
    }
    if (profile.role === "staff") {
      const managers = await supabase
        .from("profiles" as any)
        .select("id, role")
        .eq("garden_id", payload.garden_id)
        .in("role", ["manager", "owner"]);
      if (managers.error) {
        console.error("[incident-reports:notify-managers]", { garden_id: payload.garden_id, error: managers.error.message });
      } else {
        await supabase.from("notifications" as any).insert(((managers.data ?? []) as any[]).map((manager) => ({
          garden_id: payload.garden_id,
          recipient_id: manager.id,
          recipient_profile_id: manager.id,
          recipient_role: manager.role,
          title: "אירוע חדש דווח על ידי צוות",
          message: payload.title,
          body: payload.description,
          severity: payload.severity === "critical" || payload.severity === "high" ? "urgent" : "warning",
          status: "unread",
          entity_type: "incident_reports",
          entity_id: data.id,
          action_url: "/dashboard/garden/incidents?status=open",
          metadata: { child_id: payload.child_id ?? null, reported_by: profile.id }
        })));
      }
    }
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
