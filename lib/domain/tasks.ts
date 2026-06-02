import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const escalateTaskSchema = z.object({
  reason: z.string().min(3)
});

export async function markTaskViewed(taskId: string, request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("task_view_logs")
    .insert({
      task_id: taskId,
      viewer_id: user.id,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
      user_agent: request.headers.get("user-agent")
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("tasks").update({ viewed_at: new Date().toISOString() } as any).eq("id", taskId);
  return data;
}

export async function escalateTask(taskId: string, reason: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("escalate_task" as any, {
    p_task_id: taskId,
    p_reason: reason
  });
  if (error) throw new Error(error.message);
  return data;
}
