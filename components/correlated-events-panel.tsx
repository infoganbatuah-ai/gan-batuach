"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ShieldCheck, Video, Waves } from "lucide-react";
import { correlationTypeLabels } from "@/lib/domain/multi-camera-correlation-engine";

type Row = Record<string, any>;
type Option = { id: string; name: string; garden_id?: string | null; kindergarten_id?: string | null };

const statusLabels: Record<string, string> = {
  open: "פתוח",
  reviewing: "בבדיקה",
  confirmed: "אושר",
  dismissed: "נדחה",
  escalated: "הוסלם",
  false_positive: "False positive",
  needs_more_data: "צריך עוד מידע"
};

function tone(status?: string) {
  if (status === "confirmed") return "pill good";
  if (status === "escalated") return "pill bad";
  if (status === "dismissed" || status === "false_positive") return "pill";
  return "pill warn";
}

function percent(value: unknown) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

function sourceLabel(sourceType?: string) {
  return ({
    ai_camera_event: "וידאו",
    audio_observer_event: "שמע",
    safety_incident: "בטיחות",
    pickup_event: "איסוף",
    watch_request_event: "בקשת מעקב",
    camera_health: "מצלמה",
    mock: "Mock"
  } as Record<string, string>)[sourceType ?? "mock"] ?? sourceType;
}

export function CorrelatedEventsPanel({
  role,
  fixedKindergartenId,
  events,
  links,
  cameras,
  zones,
  gardens = []
}: {
  role: "admin" | "garden";
  fixedKindergartenId?: string | null;
  events: Row[];
  links: Row[];
  cameras: Option[];
  zones: Option[];
  gardens?: Option[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedGardenId, setSelectedGardenId] = useState(fixedKindergartenId ?? gardens[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const scopedEvents = events.filter((event) => !selectedGardenId || event.kindergarten_id === selectedGardenId);
  const metrics = useMemo(() => {
    const multiCamera = scopedEvents.filter((event) => (event.involved_camera_ids ?? []).length > 1).length;
    const sensorTypes = new Set(scopedEvents.flatMap((event) => Object.keys(event.confidence_factors ?? {}).includes("sensor_type_count") ? [event.confidence_factors.sensor_type_count] : []));
    const falsePositive = scopedEvents.filter((event) => event.status === "false_positive").length;
    const averageConfidence = scopedEvents.length ? scopedEvents.reduce((sum, event) => sum + Number(event.confidence ?? 0), 0) / scopedEvents.length : 0;
    return { multiCamera, sensorTypes: sensorTypes.size, falsePositive, averageConfidence };
  }, [scopedEvents]);

  async function post(payload: Record<string, unknown>) {
    const response = await fetch("/api/observer-correlated-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "הפעולה נכשלה");
      return;
    }
    setMessage("נשמר. האירוע דורש review אנושי.");
    router.refresh();
  }

  function createMock(formData: FormData) {
    const gardenId = String(formData.get("kindergarten_id") || selectedGardenId);
    const cameraA = String(formData.get("camera_a") || "");
    const cameraB = String(formData.get("camera_b") || "");
    const zoneA = String(formData.get("zone_a") || "");
    const zoneB = String(formData.get("zone_b") || "");
    const now = Date.now();
    const sources = [
      {
        source_type: "ai_camera_event",
        source_id: crypto.randomUUID(),
        camera_id: cameraA || null,
        zone_id: zoneA || null,
        event_time: new Date(now - 120000).toISOString(),
        confidence: 0.54,
        title: "אינדיקציית וידאו mock",
        severity: "medium"
      },
      {
        source_type: cameraB ? "ai_camera_event" : "audio_observer_event",
        source_id: crypto.randomUUID(),
        camera_id: cameraB || cameraA || null,
        zone_id: zoneB || null,
        event_time: new Date(now - 45000).toISOString(),
        confidence: cameraB ? 0.62 : 0.48,
        title: cameraB ? "אישור ממצלמה נוספת mock" : "אינדיקציית שמע mock",
        severity: String(formData.get("severity") || "medium")
      }
    ];
    setMessage(null);
    startTransition(() => void post({
      action: "create_mock_correlation",
      kindergarten_id: gardenId,
      correlation_type: formData.get("correlation_type"),
      sources
    }));
  }

  function review(id: string, status: string) {
    setMessage(null);
    startTransition(() => void post({ action: "review", id, status, review_notes: "Review אנושי. אין זיהוי זהות ואין מעקב ביומטרי." }));
  }

  return (
    <div className="stack">
      {message ? <div className={message.includes("נכשלה") ? "notice warning" : "notice success"}>{message}</div> : null}
      {role === "admin" ? (
        <label className="form-field card">
          <span>גן</span>
          <select value={selectedGardenId} onChange={(event) => setSelectedGardenId(event.target.value)}>
            {gardens.map((garden) => <option value={garden.id} key={garden.id}>{garden.name}</option>)}
          </select>
        </label>
      ) : null}

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><GitBranch /><strong>{scopedEvents.length}</strong><span>אירועים מקושרים</span></article>
        <article className="metric-card"><Video /><strong>{metrics.multiCamera}</strong><span>יותר ממצלמה אחת</span></article>
        <article className="metric-card"><Waves /><strong>{percent(metrics.averageConfidence)}</strong><span>Confidence ממוצע</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{metrics.falsePositive}</strong><span>False positives</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <form className="card form compact-form" action={createMock}>
          <div>
            <p className="eyebrow">Mock correlation</p>
            <h2>יצירת ציר זמן בין מצלמות</h2>
            <p>קישור אירועים בלבד. אין זיהוי אדם, אין מעקב ביומטרי ואין פרופיל ילדים/צוות.</p>
          </div>
          {role === "admin" ? <input type="hidden" name="kindergarten_id" value={selectedGardenId} /> : <input type="hidden" name="kindergarten_id" value={fixedKindergartenId ?? ""} />}
          <label>סוג correlation<select name="correlation_type" defaultValue="multi_camera_timeline">{Object.entries(correlationTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <div className="form-grid two">
            <label>מצלמה א<select name="camera_a"><option value="">ללא מצלמה</option>{cameras.filter((camera) => !selectedGardenId || camera.garden_id === selectedGardenId || camera.kindergarten_id === selectedGardenId).map((camera) => <option value={camera.id} key={camera.id}>{camera.name}</option>)}</select></label>
            <label>מצלמה ב<select name="camera_b"><option value="">שמע/מקור אחר</option>{cameras.filter((camera) => !selectedGardenId || camera.garden_id === selectedGardenId || camera.kindergarten_id === selectedGardenId).map((camera) => <option value={camera.id} key={camera.id}>{camera.name}</option>)}</select></label>
            <label>אזור כניסה<select name="zone_a"><option value="">ללא אזור</option>{zones.filter((zone) => !selectedGardenId || zone.kindergarten_id === selectedGardenId).map((zone) => <option value={zone.id} key={zone.id}>{zone.name}</option>)}</select></label>
            <label>אזור יעד<select name="zone_b"><option value="">ללא אזור</option>{zones.filter((zone) => !selectedGardenId || zone.kindergarten_id === selectedGardenId).map((zone) => <option value={zone.id} key={zone.id}>{zone.name}</option>)}</select></label>
            <label>חומרה<select name="severity" defaultValue="medium"><option value="low">נמוכה</option><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="urgent">דחופה</option></select></label>
          </div>
          <button className="button primary" disabled={isPending}>יצירת mock timeline</button>
        </form>
        <article className="card action-panel">
          <h2>Correlation principles</h2>
          <div className="risk-list">
            <div>קישור אירועים <b>כן</b></div>
            <div>זיהוי זהות <b>לא</b></div>
            <div>מעקב ביומטרי <b>לא</b></div>
            <div>Review אנושי <b>חובה</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Correlated events</h2><p>ציר זמן מאוחד בין מצלמות/חיישנים. Human review לפני כל הסלמה.</p></div>
        {scopedEvents.length === 0 ? <div className="empty-state"><strong>אין אירועים מקושרים</strong><span>אירועי mock או correlation עתידי יופיעו כאן.</span></div> : (
          <div className="procedure-list">
            {scopedEvents.map((event) => {
              const eventLinks = links.filter((link) => link.correlated_event_id === event.id).sort((a, b) => Number(a.sequence_order ?? 0) - Number(b.sequence_order ?? 0));
              const timeline = Array.isArray(event.timeline_summary) ? event.timeline_summary : [];
              return (
                <article className="card procedure-card" key={event.id}>
                  <div>
                    <span className={tone(event.status)}>{statusLabels[event.status] ?? event.status}</span>
                    <span className="pill">{correlationTypeLabels[event.correlation_type] ?? event.correlation_type}</span>
                    <span className="pill">confidence {percent(event.confidence)}</span>
                    <h3>ציר זמן מקושר</h3>
                    <p>{(event.involved_camera_ids ?? []).length} מצלמות · {(event.involved_zone_ids ?? []).length} אזורים · {eventLinks.length || timeline.length} נקודות</p>
                    <div className="timeline-list">
                      {(eventLinks.length ? eventLinks : timeline).map((item: Row, index: number) => (
                        <div className="list-item" key={`${event.id}-${index}`}>
                          <div><strong>{sourceLabel(item.source_type)}</strong><span>{item.event_time ? new Date(item.event_time).toLocaleString("he-IL") : "זמן לא ידוע"} · {item.camera_streams?.name ?? item.camera_id ?? "מקור"}</span></div>
                          <span className="pill">{item.sequence_order ?? item.order ?? index + 1}</span>
                        </div>
                      ))}
                    </div>
                    <small>אין זיהוי זהות · אין מעקב ביומטרי · אין פרופיל ילדים/צוות</small>
                  </div>
                  <div className="procedure-meta">
                    <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "reviewing")}>בבדיקה</button>
                    <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "confirmed")}>אישור</button>
                    <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "dismissed")}>דחייה</button>
                    <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "escalated")}>הסלמה</button>
                    <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "false_positive")}>False positive</button>
                    <button className="button secondary" disabled={isPending} onClick={() => review(event.id, "needs_more_data")}>צריך עוד מידע</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
