import { z } from "zod";
import { randomUUID } from "node:crypto";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { formatObserverDate } from "@/lib/domain/digital-observer/runtime";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import { observerConversationCatalog, observerConversationLinks, parseObserverConversationIntent, verifiedConversationActionEvidence } from "@/lib/domain/digital-observer/conversation-actions";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  observer_site_id: z.string().uuid(),
  camera_source_id: z.string().uuid().optional(),
  message: z.string().trim().min(2).max(1200)
});

type SignalRow = {
  id: string;
  camera_id: string | null;
  signal_type: string | null;
  severity: string | null;
  confidence: number | null;
  review_status: string | null;
  recommended_action: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function eventType(signal: SignalRow) {
  return String(signal.metadata?.event_type || signal.signal_type || "system");
}

function matchesAny(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

function classifyInstruction(message: string) {
  if (matchesAny(message, ["דלת", "פתוחה"])) return "door_left_open";
  if (matchesAny(message, ["רכב", "מכונית", "חניה"])) return "person_near_object";
  if (matchesAny(message, ["אחרי שעות", "בלילה", "מחוץ לשעות"])) return "after_hours_activity";
  if (matchesAny(message, ["אזור", "חדר", "כניסה", "יציאה"])) return "movement_in_area";
  if (matchesAny(message, ["מכוסה", "תקולה", "מנותקת"])) return "camera_obstruction";
  return "custom_text_instruction";
}

function filteredSignals(message: string, signals: SignalRow[]) {
  if (matchesAny(message, ["רכב", "מכונית", "חניה"])) {
    return signals.filter((signal) => matchesAny(eventType(signal), ["vehicle", "car", "parking"]));
  }
  if (matchesAny(message, ["מי", "אדם", "נכנס", "יצא", "פנים"])) {
    return signals.filter((signal) => matchesAny(eventType(signal), ["person", "entry", "exit", "face", "unknown"]));
  }
  if (matchesAny(message, ["חריג", "חשוד", "דחוף", "סכנה"])) {
    return signals.filter((signal) => ["medium", "high", "urgent", "critical"].includes(String(signal.severity)));
  }
  if (matchesAny(message, ["מצלמה", "מנותקת", "תקלה"])) {
    return signals.filter((signal) => matchesAny(eventType(signal), ["camera", "offline", "obstruction"]));
  }
  return signals;
}

function buildAnswer(message: string, signals: SignalRow[], cameras: any[], baselines: any[]) {
  const relevant = filteredSignals(message, signals).slice(0, 5);
  const reviewed = signals.filter((signal) => ["confirmed", "resolved", "dismissed"].includes(String(signal.review_status))).length;
  const open = signals.filter((signal) => ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status))).length;
  const online = cameras.filter((camera) => ["connected", "healthy", "online", "active"].includes(String(camera.status ?? camera.health_status))).length;

  if (matchesAny(message, ["מצב", "סטטוס", "הכול בסדר"]) && !matchesAny(message, ["שים לב", "תעקוב", "תתריע"])) {
    return {
      answer: `כרגע ${online} מתוך ${cameras.length} מקורות מצלמה מסומנים כמחוברים. במידע שנטען: ${open} אירועים ממתינים לבדיקה ו-${reviewed} אירועים נבדקו. ${baselines.length ? `קיימות ${baselines.length} רשומות מדדי שגרה; עצם קיומן אינו מעיד על מודל מכויל.` : "אין רשומות שגרה זמינות."} סטטוס מקור אינו הוכחה לשידור רציף או לניתוח וידאו.`,
      signalIds: relevant.map((signal) => signal.id)
    };
  }

  if (!relevant.length) {
    return {
      answer: "לא נמצאה התאמה באירועים השמורים שנטענו מ-48 השעות האחרונות. זה לא מוכיח שלא הייתה פעילות: לא נסרקו הקלטות DVR, ולא אומת כיסוי ניתוח רציף. אפשר לבחור מצלמה או לפתוח את יומן האירועים לבדיקה.",
      signalIds: []
    };
  }

  const lines = relevant.map((signal) => {
    const report = observerEventNarrative(signal);
    const confidence = report.confidence == null ? "ללא ציון ביטחון" : `${Math.round(report.confidence * 100)}% ביטחון`;
    const source = cameras.find((camera) => camera.id === signal.metadata?.camera_source_id || camera.id === signal.camera_id);
    return `${report.label} · ${source?.display_name || "מקור לא מאומת"} · ${formatObserverDate(signal.created_at)} (${confidence}). ${report.conclusion}`;
  });
  return {
    answer: `מצאתי ${relevant.length} אירועים מתאימים במידע השמור:\n${lines.map((line) => `• ${line}`).join("\n")}\nכל זיהוי הוא הערכה ודורש בדיקה אנושית לפני פעולה.`,
    signalIds: relevant.map((signal) => signal.id)
  };
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());
    const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לשוחח על האתר הזה.", 403);

    let signalQuery = supabase.from("observer_intelligence_signals" as any)
        .select("id,camera_id,signal_type,severity,confidence,review_status,recommended_action,metadata,created_at")
        .eq("observer_site_id", payload.observer_site_id)
        .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
    if (payload.camera_source_id) signalQuery = signalQuery.or(`camera_id.eq.${payload.camera_source_id},metadata->>camera_source_id.eq.${payload.camera_source_id}`);
    const [signalResult, cameraResult, baselineResult] = await Promise.all([
      signalQuery
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("digital_observer_camera_sources" as any)
        .select("id,display_name,status,health_status,source_mode,capabilities,metadata")
        .eq("observer_site_id", payload.observer_site_id),
      supabase.from("site_behavior_baselines" as any)
        .select("id,baseline_type,learning_maturity,confidence_level")
        .eq("observer_site_id", payload.observer_site_id)
    ]);

    if (signalResult.error || cameraResult.error) return fail("לא ניתן לקרוא כרגע את נתוני התצפיתן.", 503);
    const selectedCamera = payload.camera_source_id
      ? (cameraResult.data ?? []).find((camera: any) => camera.id === payload.camera_source_id)
      : null;
    if (payload.camera_source_id && !selectedCamera) return fail("המצלמה שנבחרה אינה שייכת לאתר הזה.", 403);
    const scopedSignals = payload.camera_source_id
      ? (signalResult.data ?? []).filter((signal: any) => signal.camera_id === payload.camera_source_id || signal.metadata?.camera_source_id === payload.camera_source_id)
      : signalResult.data ?? [];
    const scopedCameras = selectedCamera ? [selectedCamera] : cameraResult.data ?? [];
    const message = payload.message.toLowerCase();
    const parsed = parseObserverConversationIntent(message);
    const instruction = parsed.intent === "save_watch";
    const requestedPhysicalAction = parsed.physical;
    const actionEvidence = selectedCamera && requestedPhysicalAction
      ? verifiedConversationActionEvidence(selectedCamera, requestedPhysicalAction.capability)
      : null;
    const monitoringConsent = site.monitoring_enabled === true && site.metadata?.observer_monitoring_consent === true;
    const safeActionConsent = site.metadata?.observer_safe_action_consent === true;
    const actionId = randomUUID();
    const audit = async (state: string, status: string, recordId: string | null = null) => {
      try {
      const result = await createAdminClient().from("observer_capability_audit_events" as any).insert({
        event_key: `observer-chat-${actionId}-${state}`, event_type: "observer_conversation_action",
        vertical_key: "home_observer", capability_key: parsed.intent, actor_profile_id: profile.id,
        status, reason: state,
        metadata: { observer_site_id: payload.observer_site_id, camera_source_id: payload.camera_source_id ?? null,
          action_id: actionId, state, watch_request_id: recordId, physical_action_executed: false, raw_message_stored: false }
      });
      return !result.error;
      } catch {
        return false;
      }
    };
    if (!(await audit("requested", "logged"))) return fail("לא ניתן לתעד את הבקשה כרגע. לא נשמרה הנחיה ולא בוצעה פעולה.", 503);
    let requestRecord: any = null;

    if (instruction) {
      const watchType = classifyInstruction(message);
      const { data, error } = await supabase.from("observer_watch_requests" as any).insert({
        observer_site_id: payload.observer_site_id,
        kindergarten_id: null,
        camera_id: null,
        camera_source_id: payload.camera_source_id ?? null,
        created_by: profile.id,
        title: payload.message.slice(0, 120),
        description: payload.message,
        watch_type: watchType,
        active: false,
        priority: matchesAny(message, ["דחוף", "קריטי", "פריצה", "מצוקה"]) ? 9 : 5,
        schedule: { mode: "always_active", source: "observer_conversation" },
        notification_channels: ["in_app"],
        requires_human_review: true,
        metadata: {
          product: "digital_observer",
          created_from_conversation: true,
          execution_state: monitoringConsent ? "awaiting_rule_evidence" : "awaiting_monitoring_consent",
          conversation_action_id: actionId,
          monitoring_consent_verified: monitoringConsent,
          rule_execution_verified: false,
          no_automatic_emergency_call: true,
          no_automatic_accusation: true
        }
      }).select("id,title,watch_type,active,created_at").single();
      if (error || !data) {
        await audit("failed", "failed");
        return fail("הבנתי את הבקשה, אך היא לא נשמרה. אפשר לנסות שוב.", 400);
      }
      requestRecord = data;
    }

    const summary = buildAnswer(
      message,
      scopedSignals as SignalRow[],
      scopedCameras,
      baselineResult.data ?? []
    );
    const offer = requestedPhysicalAction
      ? !selectedCamera
        ? { available: false, reason: "יש לפתוח תחילה מצלמה מסוימת כדי להכין פעולה." }
        : !safeActionConsent
          ? { available: false, reason: "נדרשת הרשאת פעולות בהגדרות האתר, ולאחריה אישור מיידי לכל פעולה." }
          : actionEvidence
            ? { available: true, action_type: requestedPhysicalAction.action_type, label: requestedPhysicalAction.label, parameters: requestedPhysicalAction.parameters, camera_source_id: selectedCamera.id }
            : { available: false, reason: "נדרשים מקור מחובר, בדיקת יכולת עדכנית ומתאם מאומת למצלמה הזאת." }
      : null;
    const state = instruction ? "saved" : parsed.intent === "clarify_action" ? "needs_clarification" : offer ? offer.available ? "awaiting_confirmation" : "blocked" : "executed";
    const resultAudited = await audit(state, state === "blocked" ? "blocked" : "success", requestRecord?.id ?? null);
    const answer = instruction
      ? `שמרתי את ההנחיה עבור ${selectedCamera?.display_name || "מקורות האתר"}, אך לא הפעלתי כלל על הווידאו. ${monitoringConsent ? "הסכמת הניטור קיימת; עדיין נדרש אימות שמנוע הכללים בודק את ההנחיה הזאת בפועל." : "יש לאשר ניטור בהגדרות ולאמת מנוע מתאים להנחיה."}\n\n${summary.answer}`
      : parsed.intent === "clarify_action"
        ? "יש לציין פעולה אחת ומצלמה, ובהזזה גם כיוון. לא הוכנה ולא בוצעה פעולה."
        : parsed.intent === "guide_navigation"
          ? "הקישורים למטה פותחים את המסכים של האתר שנבחר. שינויים בהסכמות, באנשים ובמצלמות נעשים במסך המתאים ולא בוצעו מהשיחה הזאת."
        : offer ? offer.available ? "אפשר להכין את הפעולה לאישור מיידי בכפתור למטה. עדיין לא נשלחה פקודה למצלמה." : offer.reason : summary.answer;
    return ok({
      answer: instruction
        ? `${answer}${resultAudited ? "" : "\nההנחיה נשמרה אך תיעוד התוצאה נכשל; אין לשלוח אותה שוב."}`
        : `${answer}${resultAudited ? "" : "\nתיעוד תוצאת הבקשה נכשל; לא בוצעה פעולה פיזית."}`,
      action_result: { id: actionId, intent: parsed.intent, state, requested_audited: true, result_audited: resultAudited, physical_action_executed: false },
      action_catalog: observerConversationCatalog,
      links: observerConversationLinks(payload.observer_site_id, payload.camera_source_id, summary.signalIds),
      source_label: "אירועים שמורים וסטטוס מדווח; לא ניתוח וידאו חי",
      coverage: { window_hours: 48, source_count: scopedCameras.length, returned_events: scopedSignals.length, limit_reached: (signalResult.data ?? []).length >= 100, continuous_analysis_verified: false, dvr_archive_scanned: false },
      signal_ids: summary.signalIds,
      request: requestRecord,
      answer_source: payload.camera_source_id ? "camera_scoped_runtime_data" : "site_scoped_runtime_data",
      live_ai_used: false,
      emergency_action_triggered: false,
      suggested_camera_action: offer
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
