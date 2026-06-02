import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const journalSchema = z.object({
  garden_id: z.string().uuid(),
  child_id: z.string().uuid(),
  journal_date: z.string().optional(),
  meals: z.array(z.object({ title: z.string(), note: z.string().optional() })).default([]),
  sleep_summary: z.string().optional(),
  sleep_minutes: z.coerce.number().optional(),
  mood: z.string().optional(),
  bathroom: z.string().optional(),
  medicine: z.string().optional(),
  incidents: z.string().optional(),
  notes_to_parents: z.string().optional(),
  photo_urls: z.array(z.string()).default([]),
  staff_signature: z.string().optional()
});

export async function GET(request: Request) {
  try {
    await requireRole(["admin", "manager", "owner", "staff", "parent", "inspector"]);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const gardenId = searchParams.get("garden_id");
    const childId = searchParams.get("child_id");
    let query = supabase.from("child_daily_journals" as any).select("*, children(full_name, photo_url)").order("journal_date", { ascending: false }).limit(80);
    if (gardenId) query = query.eq("garden_id", gardenId);
    if (childId) query = query.eq("child_id", childId);
    const { data, error } = await query;
    if (error) {
      console.error("[child-daily-journals:get]", error);
      return fail("לא ניתן לטעון את היומן כרגע", 400);
    }
    return ok(data ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner", "staff"]);
    const payload = journalSchema.parse(await request.json());
    if (profile.role !== "admin" && profile.garden_id !== payload.garden_id) return fail("אין הרשאה לעדכן יומן של גן אחר", 403);
    const supabase = await createClient();
    const row = { ...payload, journal_date: payload.journal_date ?? new Date().toISOString().slice(0, 10), created_by: profile.id, updated_by: profile.id, parent_notified_at: new Date().toISOString() };
    const { data, error } = await supabase.from("child_daily_journals" as any).upsert(row, { onConflict: "child_id,journal_date" }).select("*").single();
    if (error) {
      console.error("[child-daily-journals:post]", error);
      return fail("לא ניתן לשמור יומן ילד כרגע", 400);
    }
    const { data: child } = await supabase.from("children" as any).select("full_name, primary_parent_id, parents:primary_parent_id(profile_id)").eq("id", payload.child_id).maybeSingle();
    const parentProfileId = (child as any)?.parents?.profile_id;
    if (parentProfileId) {
      await supabase.from("notifications" as any).insert({
        garden_id: payload.garden_id,
        recipient_id: parentProfileId,
        recipient_role: "parent",
        title: "עדכון יומי לילד/ה",
        body: `עודכן יומן יומי עבור ${(child as any)?.full_name ?? "הילד/ה"}`,
        entity_type: "child_daily_journal",
        entity_id: data.id,
        status: "pending"
      });
    }
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
