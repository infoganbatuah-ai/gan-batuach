import { observerEventNarrative, type ObserverEventLike } from "@/lib/domain/digital-observer/event-narrative";
import { observerEventMediaReason, type EventMediaState } from "@/lib/domain/digital-observer/event-evidence";

export function ObserverEventAssessment({ event, mediaState }: { event: ObserverEventLike; mediaState: EventMediaState }) {
  const narrative = observerEventNarrative(event);
  return <dl className="do-event-assessment" aria-label="מסקנות התצפיתן וראיות האירוע">
    <div><dt>מה דווח</dt><dd>{narrative.summary}</dd></div>
    <div><dt>הסיבה לבדיקה</dt><dd>{narrative.reason}</dd></div>
    <div><dt>מסקנה לביקורת</dt><dd>{narrative.conclusion}</dd></div>
    <div><dt>זהות והרשאת כניסה</dt><dd>{narrative.identityLabel}</dd></div>
    <div><dt>רמת ביטחון שדווחה</dt><dd>{narrative.confidence === null ? "לא נמסרה" : `${Math.round(narrative.confidence * 100)}%`}</dd></div>
    <div><dt>ראיות</dt><dd>{observerEventMediaReason(mediaState)}</dd></div>
  </dl>;
}
