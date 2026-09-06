import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { formatObserverDate, observerEventLabel } from "@/lib/domain/digital-observer/runtime";
import { eventJournalService } from "@/lib/domain/event-engine/event-journal-service";
import { guardChatHandler } from "@/lib/domain/digital-observer/guard-chat-handler";
import { guardJournalQuerySchema, guardQueryClarification } from "@/lib/domain/digital-observer/guard-chat-query";
import { guardContextForSite, guardHistoryPrivacyRestricted, guardHistoryInput, guardJournalAnswer, searchGuardJournal } from "@/lib/domain/event-engine/guard-journal-search";
import { compileAuthorizedWatchRule } from "@/lib/domain/digital-observer/watch-rule-service";

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
    const message = payload.message.toLowerCase();
    const chatIntent = guardChatHandler.classify(payload.message);
    const instruction = matchesAny(message, ["שים לב", "תעקוב", "תתריע", "תבדוק מעכשיו"]);
    let requestRecord: any = null;

    if (instruction) {
      const { compilation } = await compileAuthorizedWatchRule({
        db: supabase,
        observerSiteId: payload.observer_site_id,
        timezone: String(site.timezone ?? "Asia/Jerusalem"),
        text: payload.message,
        explicitCameraSourceId: payload.camera_source_id
      });
      requestRecord = { ...compilation, activated: false };
    }

    const summary = buildAnswer(
      message,
      journalSignals as SignalRow[],
      scopedCameras,
      baselineResult.data ?? []
    );
    return ok({
      answer: instruction
        ? requestRecord?.status === "READY_FOR_CONFIRMATION"
          ? `הכנתי פירוש מובנה לבקשה, אבל לא הפעלתי אותו. יש לעבור לתצוגה המקדימה במסך הכללים ולאשר במפורש: ${requestRecord.preview?.event} · ${requestRecord.preview?.camera} · ${requestRecord.preview?.time}.`
          : requestRecord?.status === "NEEDS_CLARIFICATION"
            ? requestRecord.clarification?.question || "נדרשת הבהרה לפני יצירת כלל."
            : requestRecord?.unsupported?.explanation || "לא ניתן להפוך את הבקשה לכלל נתמך ובטוח."
        : summary.answer,
      signal_ids: summary.signalIds,
      event_log: eventLog,
      intent: chatIntent,
      request: requestRecord,
      answer_source: payload.camera_source_id ? "camera_scoped_runtime_data" : "site_scoped_runtime_data",
      live_ai_used: false,
      rule_activation_requires_confirmation: instruction,
      emergency_action_triggered: false
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
