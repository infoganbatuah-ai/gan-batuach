import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const inspectionAnswerSchema = z.object({
  question_id: z.string().uuid(),
  score: z.number().int().min(1).max(10).optional(),
  boolean_value: z.boolean().optional(),
  text_value: z.string().optional(),
  note: z.string().optional(),
  photo_url: z.string().url().optional(),
  document_url: z.string().url().optional()
});

export const inspectionSubmitSchema = z.object({
  gps_lat: z.number(),
  gps_lng: z.number(),
  gps_radius_meters: z.number().positive().default(120),
  answers: z.array(inspectionAnswerSchema).min(1)
});

export async function createMonthlyInspectionTasks(month?: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_monthly_inspection_tasks", {
    p_month: month ?? new Date().toISOString().slice(0, 10)
  } as any);
  if (error) throw new Error(error.message);
  return data;
}

export async function submitInspection(inspectionId: string, payload: z.infer<typeof inspectionSubmitSchema>) {
  const parsed = inspectionSubmitSchema.parse(payload);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_inspection_with_answers", {
    p_inspection_id: inspectionId,
    p_answers: parsed.answers,
    p_gps_lat: parsed.gps_lat,
    p_gps_lng: parsed.gps_lng,
    p_gps_radius_meters: parsed.gps_radius_meters
  } as any);
  if (error) throw new Error(error.message);
  return data;
}
