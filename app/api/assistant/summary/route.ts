import { ok, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  createNotificationsForUrgentInsights,
  generateSmartInsights,
  summarizeInsightsForAssistant,
  syncSmartInsights
} from "@/lib/domain/smart-kindergarten-engine";
import {
  assistantContextSources,
  assistantDailyBriefing,
  assistantNotificationIntelligence,
  assistantPermissionMode,
  assistantPermissionSummary,
  buildAssistantContextScope,
  normalizeAssistantQuestion
} from "@/lib/domain/ai-executive-assistant";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { profile } = await requireUser();
    const supabase = await createClient();
    const generated = await generateSmartInsights(supabase as any, profile);
    const persisted = await syncSmartInsights(supabase as any, generated);
    await createNotificationsForUrgentInsights(supabase as any, persisted);
    const summary = summarizeInsightsForAssistant(profile.role, persisted);
    const session = await supabase.from("ai_assistant_sessions" as any).insert({
      profile_id: profile.id,
      role: profile.role,
      session_title: summary.title,
      context_scope: buildAssistantContextScope(profile),
      permission_mode: assistantPermissionMode(profile.role),
      provider_mode: summary.provider === "connected" ? "external_ai_ready" : "rules_based",
      last_message_at: new Date().toISOString()
    }).select("id").single();
    if (session.error) console.error("[assistant-summary] session insert failed", session.error);
    return ok({
      ...summary,
      session_id: (session.data as any)?.id ?? null,
      context_sources: assistantContextSources(profile.role),
      permission_summary: assistantPermissionSummary(profile.role),
      daily_briefing: assistantDailyBriefing(profile.role, persisted),
      notification_intelligence: assistantNotificationIntelligence(persisted)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const supabase = await createClient();
    const payload = await request.json().catch(() => ({}));
    const prompt = String(payload.prompt ?? "").trim();
    const response = String(payload.response ?? "").trim();
    const sessionId = String(payload.session_id ?? "").trim();
    if (!prompt || !response || !sessionId) return ok({ saved: false, reason: "missing_prompt_response_or_session" });

    const session = await supabase.from("ai_assistant_sessions" as any).select("id, profile_id, role").eq("id", sessionId).maybeSingle();
    if (session.error || !session.data || (session.data as any).profile_id !== profile.id) return ok({ saved: false, reason: "session_not_available" });

    const contextSources = Array.isArray(payload.context_sources) ? payload.context_sources.map(String) : assistantContextSources(profile.role);
    const suggestedActions = Array.isArray(payload.suggested_actions) ? payload.suggested_actions : [];
    const unresolved = response.includes("לא ניתן") || response.includes("אין מספיק") || response.includes("לא זוהו") === false && prompt.includes("?");
    const insert = await supabase.from("ai_assistant_messages" as any).insert({
      session_id: sessionId,
      profile_id: profile.id,
      role: profile.role,
      prompt,
      response,
      suggested_actions: suggestedActions,
      context_sources: contextSources,
      permission_summary: assistantPermissionSummary(profile.role),
      unresolved
    });
    if (insert.error) console.error("[assistant-summary] message insert failed", insert.error);

    await supabase.from("ai_assistant_sessions" as any).update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", sessionId).eq("profile_id", profile.id);
    const questionKey = normalizeAssistantQuestion(prompt);
    const analytics = await supabase.from("ai_assistant_usage_analytics" as any).upsert({
      role: profile.role,
      question_key: questionKey,
      usage_count: 1,
      unresolved_count: unresolved ? 1 : 0,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "role,question_key" });
    if (analytics.error) console.error("[assistant-summary] analytics upsert failed", analytics.error);

    return ok({ saved: !insert.error });
  } catch (error) {
    return handleRouteError(error);
  }
}
