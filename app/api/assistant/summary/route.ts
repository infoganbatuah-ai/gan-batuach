import { ok, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  createNotificationsForUrgentInsights,
  generateSmartInsights,
  summarizeInsightsForAssistant,
  syncSmartInsights
} from "@/lib/domain/smart-kindergarten-engine";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { profile } = await requireUser();
    const supabase = await createClient();
    const generated = await generateSmartInsights(supabase as any, profile);
    const persisted = await syncSmartInsights(supabase as any, generated);
    await createNotificationsForUrgentInsights(supabase as any, persisted);
    return ok(summarizeInsightsForAssistant(profile.role, persisted));
  } catch (error) {
    return handleRouteError(error);
  }
}
