import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { formatObserverDate, observerEventLabel } from "@/lib/domain/digital-observer/runtime";
import { eventJournalService } from "@/lib/domain/event-engine/event-journal-service";
import { guardChatHandler } from "@/lib/domain/digital-observer/guard-chat-handler";
import { guardJournalQuerySchema, guardQueryClarification } from "@/lib/domain/digital-observer/guard-chat-query";
import { guardContextForSite, guardHistoryPrivacyRestricted, guardHistoryInput, guardJournalAnswer, searchGuardJournal } from "@/lib/domain/event-engine/guard-journal-search";

const schema = z.object({
  observer_site_id: z.string().uuid(),
  camera_source_id: z.string().uuid().optional(),
  journal_query: guardJournalQuerySchema.optional(),
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
      answer: `כרגע ${online} מתוך ${cameras.length} מקורות מצלמה מסומנים כמחוברים, ${open} אירועים ממתינים לבדיקה ו-${reviewed} אירועים כבר נבדקו. ${baselines.length ? `נבנים ${baselines.length} דפוסי שגרה.` : "עדיין אין מספיק נתונים לבניית שגרה."}`,
      signalIds: relevant.map((signal) => signal.id)
    };
  }

  if (!relevant.length) {
    return {
      answer: "לא מצאתי במידע השמור אירוע שמתאים לשאלה. איני ממציא פעילות שלא נקלטה. אחרי חיבור Gateway ו-AI Shadow אוכל לענות מתוך אירועי המצלמות בפועל.",
      signalIds: []
    };
  }

  const lines = relevant.map((signal) => {
    const confidence = signal.confidence == null ? "ללא ציון ביטחון" : `${Math.round(Number(signal.confidence) * 100)}% ביטחון`;
    return `${observerEventLabel(eventType(signal))} ב-${formatObserverDate(signal.created_at, { year: undefined, month: undefined, day: undefined })} (${confidence})`;
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
    // Gate every path, including free-form summaries that the history parser
    // does not recognize. The legacy fallback also reads identifying signals.
    if (guardHistoryPrivacyRestricted(site)) return fail("השיחה אינה זמינה באתר עם ילדים, במצב שלדים בלבד או כאשר סוג האתר אינו מזוהה, עד להתאמת מסנן פרטיות ייעודי. לא נקראו אירועים ולא בוצעה פעולה במצלמות.", 403);

    // Historical requests cannot fall through to watch creation or hardware actions.
    const historyCameras = await supabase.from("digital_observer_camera_sources")
      .select("id,observer_site_id,camera_stream_id,display_name,location_label,metadata")
      .eq("observer_site_id", site.id);
    if (historyCameras.error) return fail("לא ניתן לקרוא כרגע את מקורות היומן.", 503);
    const historyContext = guardContextForSite(site, historyCameras.data ?? []);
    try {
      const requestedHistory = payload.journal_query ?? guardHistoryInput(payload.message, historyContext, payload.camera_source_id);
      if (requestedHistory) {
        if (payload.camera_source_id && requestedHistory.cameraSourceId && requestedHistory.cameraSourceId !== payload.camera_source_id) return fail("בחירת המצלמה אינה תואמת לבקשת היומן.", 422);
        const result = await searchGuardJournal(supabase, { ...requestedHistory, cameraSourceId: payload.camera_source_id ?? requestedHistory.cameraSourceId }, historyContext, historyCameras.data ?? []);
        return ok({ answer: guardJournalAnswer(result), event_log: result.events, signal_ids: result.events.map(event => event.id),
          query: result.query, coverage: result.coverage, intent: "historical_journal", answer_source: "saved_journal", live_ai_used: false,
          emergency_action_triggered: false, physical_action_executed: false, request: null });
      }
    } catch (error) {
      if (error instanceof Error && error.message === "GUARD_QUERY_PRIVACY_SCOPE_UNSUPPORTED") return fail("חיפוש היסטורי זה אינו זמין באתר עם ילדים או במצב שלדים בלבד, עד להתאמת מסנן פרטיות ייעודי. לא נקראו אירועי זיהוי ולא בוצעה פעולה במצלמות.", 403);
      if (error instanceof Error && error.message === "GUARD_JOURNAL_UNAVAILABLE") return fail("לא ניתן לקרוא כרגע את יומן האירועים. לא בוצעה פעולה במצלמות.", 503);
      return fail(guardQueryClarification(error), 422);
    }

    const [signalResult, cameraResult, baselineResult] = await Promise.all([
      supabase.from("observer_intelligence_signals" as any)
        .select("id,camera_id,signal_type,severity,confidence,review_status,recommended_action,metadata,created_at")
        .eq("observer_site_id", payload.observer_site_id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("digital_observer_camera_sources" as any)
        .select("id,display_name,status,health_status,source_mode")
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
    const journalSignals = eventJournalService.groupRows(scopedSignals as Record<string, any>[], cameraResult.data ?? []);
    const eventLog = journalSignals.slice(0, 20).map(signal => eventJournalService.normalize(signal));
    const scopedCameras = selectedCamera ? [selectedCamera] : cameraResult.data ?? [];
    const connectedSourceAvailable = scopedCameras.some((camera: any) => ["connected", "healthy", "online", "active"].includes(String(camera.status ?? camera.health_status)));
    const message = payload.message.toLowerCase();
    const chatIntent = guardChatHandler.classify(payload.message);
    const instruction = matchesAny(message, ["שים לב", "תעקוב", "תתריע", "תבדוק מעכשיו"]);
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
        active: true,
        priority: matchesAny(message, ["דחוף", "קריטי", "פריצה", "מצוקה"]) ? 9 : 5,
        schedule: { mode: "always_active", source: "observer_conversation" },
        notification_channels: ["in_app"],
        requires_human_review: true,
        metadata: {
          product: "digital_observer",
          created_from_conversation: true,
          execution_state: connectedSourceAvailable ? "shadow_active" : "source_readiness",
          no_automatic_emergency_call: true,
          no_automatic_accusation: true
        }
      }).select("id,title,watch_type,active,created_at").single();
      if (error) return fail("הבנתי את הבקשה, אך לא ניתן לשמור אותה כרגע.", 400);
      requestRecord = data;
    }

    const summary = buildAnswer(
      message,
      journalSignals as SignalRow[],
      scopedCameras,
      baselineResult.data ?? []
    );
    return ok({
      answer: instruction
        ? connectedSourceAvailable
          ? `שמרתי את ההנחיה והיא פעילה במצב Shadow על ${selectedCamera?.display_name || "המקורות המחוברים"}. כל זיהוי יוצג כהערכה עם ראיה ויישאר כפוף לבדיקה אנושית.\n\n${summary.answer}`
          : `שמרתי את ההנחיה. מקור המצלמה עדיין אינו מחובר, ולכן היא תתחיל לפעול אוטומטית לאחר חיבור מאומת.\n\n${summary.answer}`
        : summary.answer,
      signal_ids: summary.signalIds,
      event_log: eventLog,
      intent: chatIntent,
      request: requestRecord,
      answer_source: payload.camera_source_id ? "camera_scoped_runtime_data" : "site_scoped_runtime_data",
      live_ai_used: false,
      emergency_action_triggered: false
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
