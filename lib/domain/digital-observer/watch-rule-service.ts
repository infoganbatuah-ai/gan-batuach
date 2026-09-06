import "server-only";
import {
  compileNaturalLanguageWatchRule,
  evaluateCanonicalWatchRule,
  type CanonicalWatchRule,
  type WatchRuleCompileResult,
  type WatchRuleCompilerResources,
  watchRequestPriority,
  watchRequestType
} from "./watch-rule-compiler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- compiler resources use tables not represented in generated database types.
type SupabaseLike = any;
type Row = Record<string, unknown>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function currentWatchRuleEnvironment(): WatchRuleCompilerResources["environment"] {
  if (process.env.VERCEL_ENV === "production") return "PRODUCTION";
  if (process.env.VERCEL_ENV === "preview") return "STAGING";
  return process.env.NODE_ENV === "test" ? "TEST" : "DEMO";
}

export async function loadWatchRuleCompilerResources(input: {
  db: SupabaseLike;
  observerSiteId: string;
  timezone: string;
  environment?: WatchRuleCompilerResources["environment"];
}): Promise<WatchRuleCompilerResources> {
  const [cameraResult, zoneResult] = await Promise.all([
    input.db.from("digital_observer_camera_sources")
      .select("id,observer_site_id,camera_stream_id,display_name,location_label,source_mode,metadata")
      .eq("observer_site_id", input.observerSiteId)
      .order("display_name"),
    input.db.from("camera_zones")
      .select("id,observer_site_id,camera_id,name,zone_type,is_active,metadata")
      .eq("observer_site_id", input.observerSiteId)
      .eq("is_active", true)
      .order("name")
  ]);
  if (cameraResult.error || zoneResult.error) throw new Error("WATCH_RULE_RESOURCES_UNAVAILABLE");
  const cameras = (cameraResult.data ?? []) as Row[];
  const sourceByStream = new Map(cameras
    .filter((camera) => typeof camera.camera_stream_id === "string")
    .map((camera) => [String(camera.camera_stream_id), String(camera.id)]));
  return {
    observerSiteId: input.observerSiteId,
    timezone: input.timezone,
    environment: input.environment ?? currentWatchRuleEnvironment(),
    cameras: cameras.map((camera) => {
      const metadata = objectValue(camera.metadata);
      return {
        id: String(camera.id),
        observerSiteId: String(camera.observer_site_id),
        name: String(camera.display_name ?? camera.location_label ?? "מצלמה"),
        locationLabel: typeof camera.location_label === "string" ? camera.location_label : null,
        sourceMode: typeof camera.source_mode === "string" ? camera.source_mode : null,
        zoneType: typeof metadata.zone_type === "string" ? metadata.zone_type
          : typeof metadata.camera_zone_type === "string" ? metadata.camera_zone_type : null
      };
    }),
    zones: ((zoneResult.data ?? []) as Row[]).map((zone) => ({
      id: String(zone.id),
      observerSiteId: String(zone.observer_site_id),
      cameraSourceId: typeof zone.camera_id === "string" ? sourceByStream.get(zone.camera_id) ?? null : null,
      name: String(zone.name ?? zone.zone_type ?? "אזור"),
      zoneType: typeof zone.zone_type === "string" ? zone.zone_type : null
    }))
  };
}

export async function compileAuthorizedWatchRule(input: {
  db: SupabaseLike;
  observerSiteId: string;
  timezone: string;
  text: string;
  explicitCameraSourceId?: string | null;
  environment?: WatchRuleCompilerResources["environment"];
}) {
  const resources = await loadWatchRuleCompilerResources(input);
  const compilation = compileNaturalLanguageWatchRule({
    text: input.text,
    resources,
    explicitCameraSourceId: input.explicitCameraSourceId
  });
  return { resources, compilation };
}

function eventFacts(row: Row) {
  const metadata = objectValue(row.metadata);
  return {
    observerSiteId: String(row.observer_site_id),
    cameraSourceId: String(metadata.camera_source_id ?? ""),
    eventId: String(row.id),
    eventType: String(metadata.event_type ?? ""),
    zoneId: typeof metadata.zone_id === "string" ? metadata.zone_id : null,
    zoneType: typeof metadata.zone_type === "string" ? metadata.zone_type : null,
    occurredAt: String(row.created_at),
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    incidentDurationSeconds: null,
    withinExpectedHours: typeof metadata.within_expected_hours === "boolean" ? metadata.within_expected_hours : null,
    provenance: String(metadata.observation_provenance ?? ""),
    validated: metadata.validated_event === true
  };
}

export async function simulateWatchRuleAgainstRealHistory(input: {
  db: SupabaseLike;
  rule: CanonicalWatchRule;
  days?: number;
}) {
  const days = Math.max(1, Math.min(30, Math.round(input.days ?? 7)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const result = await input.db.from("observer_intelligence_signals")
    .select("id,observer_site_id,source_type,confidence,created_at,metadata")
    .eq("observer_site_id", input.rule.observerSiteId)
    .eq("source_type", "system")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (result.error) throw new Error("WATCH_RULE_HISTORY_UNAVAILABLE");
  const realRows = ((result.data ?? []) as Row[]).filter((row) => {
    const metadata = objectValue(row.metadata);
    return metadata.observation_provenance === "REAL_CAMERA_AI" && metadata.validated_event === true;
  });
  const matches = realRows.map((row) => ({ row, evaluation: evaluateCanonicalWatchRule(input.rule, eventFacts(row)) }))
    .filter((item) => item.evaluation.matched);
  return {
    mode: "HISTORICAL_REAL_EVENT_SIMULATION" as const,
    days,
    evaluatedRealEventCount: realRows.length,
    matchCount: matches.length,
    matchedEventIds: matches.slice(0, 20).map((item) => String(item.row.id)),
    liveExecution: false,
    syntheticEventsUsed: false
  };
}

export function watchRuleTitle(rule: CanonicalWatchRule) {
  const event = rule.intent === "ENTRY" ? "כניסה" : rule.intent === "EXIT" ? "יציאה" : "נוכחות אדם";
  return `${event} · ${rule.target.cameraLabels.join(", ")}`.slice(0, 140);
}

export function watchRulePersistenceInput(compilation: WatchRuleCompileResult) {
  if (compilation.status !== "READY_FOR_CONFIRMATION" || !compilation.candidate || !compilation.candidateFingerprint) {
    throw new Error("WATCH_RULE_NOT_READY_FOR_CONFIRMATION");
  }
  const rule = compilation.candidate;
  return {
    title: watchRuleTitle(rule),
    watchType: watchRequestType(rule),
    priority: watchRequestPriority(rule),
    schedule: {
      mode: rule.conditions.time.mode,
      timezone: rule.conditions.time.timezone,
      start: rule.conditions.time.start,
      end: rule.conditions.time.end,
      days: rule.conditions.days
    },
    metadata: {
      natural_language_input_method: true,
      deterministic_compiler: true,
      prompt_text_executable: false,
      user_confirmation_required: true,
      capability_validated: true,
      entity_resolution: {
        camera_source_ids: rule.target.cameraSourceIds,
        camera_labels: rule.target.cameraLabels,
        zone_ids: rule.target.zoneIds,
        zone_labels: rule.target.zoneLabels
      }
    }
  };
}
