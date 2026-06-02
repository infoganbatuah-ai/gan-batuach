# Real AI Provider Integration Plan

Phase 2E defines the technical plan for connecting real AI vision and audio providers to the Gan Batuach Digital Observer.

This phase does not implement provider calls, does not process real child video, and does not send frames or audio to external AI services.

## Current Foundation

Existing foundation:

- `ai_camera_events` stores review-first observer events.
- `observer_jobs` models a future worker queue.
- `observer_rules` supports thresholds, priority and cooldown.
- `camera_zones` prepares camera area context.
- `lib/domain/ai-observer/detection-engine.ts` exposes a detection provider interface.
- `lib/domain/ai-observer/rule-engine.ts` applies rule thresholds, cooldown and dedupe.

The detection interface now supports future inputs:

- image frame
- video clip
- audio segment
- metadata
- zone context
- camera context
- child/staff context, only where consent allows
- confidence result
- explanation
- cost estimate
- consent context
- budget context

## Provider Options

### OpenAI Vision

Strengths:

- Strong image understanding and natural-language explanations.
- Good for complex scene interpretation and review summaries.
- Can help phrase careful Hebrew review text.

Weaknesses:

- External cloud processing.
- Not ideal for high-frequency per-camera frame analysis at scale.
- Requires careful data minimization.

Privacy impact:

- High. Frames leave the Gan Batuach environment unless hosted in a protected provider flow.

Cost impact:

- Medium to high depending on sampling frequency.

Latency:

- Medium. Good for periodic review, less ideal for ultra-low-latency safety alerts.

Technical complexity:

- Medium.

Recommended use:

- Later-stage review enrichment, explanation, and low-frequency event validation. Not the first live detector.

### Gemini Vision

Strengths:

- Strong multimodal support.
- Useful for image/video reasoning and scene summaries.

Weaknesses:

- External cloud processing.
- Provider-specific prompt and safety behavior must be tested.

Privacy impact:

- High.

Cost impact:

- Medium to high.

Latency:

- Medium.

Technical complexity:

- Medium.

Recommended use:

- Secondary cloud comparison or future review summarization.

### Azure Vision

Strengths:

- Enterprise controls and regional/cloud governance options.
- Good fit for organizations already on Microsoft infrastructure.

Weaknesses:

- Less flexible for nuanced custom safety reasoning without extra services.
- Configuration and compliance setup may be heavier.

Privacy impact:

- Medium to high depending on region and contract.

Cost impact:

- Medium.

Latency:

- Medium.

Technical complexity:

- Medium to high.

Recommended use:

- Enterprise deployments where governance and procurement matter.

### AWS Rekognition

Strengths:

- Mature object/person detection.
- Strong ecosystem for video workflows.
- Can support face workflows later, with strict consent.

Weaknesses:

- Face workflows are sensitive and should not be early V1.
- Complex policy setup.

Privacy impact:

- High for face recognition, medium/high for object detection.

Cost impact:

- Medium to high for video analysis.

Latency:

- Medium.

Technical complexity:

- High for production video pipelines.

Recommended use:

- Later-stage cloud video pipeline if AWS becomes the production infrastructure.

### YOLO / Ultralytics

Strengths:

- Good real-time object/person detection.
- Can run locally or near the gateway.
- Lower privacy exposure if frames stay on edge/server.
- Lower cost per frame after infrastructure is running.

Weaknesses:

- Requires model hosting and tuning.
- Scene understanding is narrower than large vision models.
- Needs engineering around false positives.

Privacy impact:

- Low to medium if run locally/edge.

Cost impact:

- Low per inference, medium infrastructure cost.

Latency:

- Low.

Technical complexity:

- Medium to high.

Recommended use:

- Best first real detector for person/object presence, restricted areas, crowding and door/gate state.

### OpenCV

Strengths:

- Useful for camera health, motion, black-frame/frozen-frame checks and simple geometry.
- Lightweight and local.
- Low cost.

Weaknesses:

- Limited semantic understanding.
- Not enough for nuanced safety events alone.

Privacy impact:

- Low if local.

Cost impact:

- Low.

Latency:

- Low.

Technical complexity:

- Medium.

Recommended use:

- First production layer for camera health, motion, offline/frozen/covered camera checks.

### Custom Models

Strengths:

- Can be tuned for kindergarten-specific safety scenarios.
- Can run locally/edge.

Weaknesses:

- Requires dataset, labeling, training, monitoring and model governance.
- Highest long-term maintenance burden.

Privacy impact:

- Medium unless training data and inference are strictly controlled.

Cost impact:

- High upfront, variable ongoing.

Latency:

- Low to medium depending on deployment.

Technical complexity:

- Very high.

Recommended use:

- Later, after pilot data, consent model and false-positive workflow are mature.

## Audio Provider Options

### Speech-To-Text

Strengths:

- Enables keyword detection after transcription.
- Useful for emergency phrase detection where consent allows.

Weaknesses:

- Very sensitive privacy area.
- Background kindergarten audio is noisy.
- Requires strict consent.

Privacy impact:

- Very high.

Cost impact:

- Medium to high depending on audio duration.

Latency:

- Medium.

Technical complexity:

- High.

Recommended use:

- Not early. Only after explicit audio consent and legal review.

### Keyword Detection

Strengths:

- Can be narrower than full transcription.
- Lower data exposure if local.

Weaknesses:

- False positives in noisy environments.
- Hebrew support must be tested carefully.

Privacy impact:

- High if cloud, medium if local.

Cost impact:

- Low to medium.

Latency:

- Low to medium.

Technical complexity:

- Medium.

Recommended use:

- Later, only for explicitly consented emergency keywords.

### Sound Anomaly Detection

Strengths:

- May detect unusual loudness, repeated distress sounds or abnormal silence without storing words.
- Can run locally.

Weaknesses:

- Hard to interpret.
- Needs careful false-positive handling.

Privacy impact:

- Medium if local and non-transcriptive.

Cost impact:

- Low to medium.

Latency:

- Low.

Technical complexity:

- Medium.

Recommended use:

- Safer first audio path than transcription, but still requires explicit audio consent.

## Recommended First Implementation Path

### Phase 1: Lowest-Risk Observer

Goal: operational safety without identity recognition.

- Camera health.
- Camera offline/frozen/covered.
- Motion/person presence.
- Restricted area rules.
- Door/gate open.
- Object/person detection only.
- No face recognition.
- No audio.
- No child identity recognition.

Recommended technology:

- OpenCV for camera health and simple motion.
- YOLO/Ultralytics for person/object detection.
- Rule engine creates suspected events only.

### Phase 2: Safety Pattern Detection

- Fall suspected.
- Crowding suspected.
- Door/gate open with time threshold.
- Restricted area with zone context.

Recommended technology:

- YOLO/Ultralytics plus rule engine.
- Optional cloud vision only for low-frequency review validation.

### Phase 3: Identity And Audio, Consent-Gated

- Face matching.
- Pickup identity.
- Audio anomaly.
- Keyword detection.

Requirements:

- Explicit parent/staff/kindergarten consent.
- Separate enablement per camera.
- No default activation.
- Strong audit logs.

### Phase 4: Learning Layer

- Routine learning.
- Behavioral pattern detection.
- Recurring anomaly patterns.
- False-positive reduction.

Requirements:

- Pilot history.
- Model governance.
- Human review metrics.
- Privacy review.

## Provider Order Recommendation

1. OpenCV for camera health and cheap local checks.
2. YOLO/Ultralytics for local/edge person and object detection.
3. OpenAI Vision or Gemini Vision for limited review enrichment, not high-frequency detection.
4. Azure/AWS only if customer procurement, region or enterprise governance requires them.
5. Face/audio/custom models only after explicit consent and pilot validation.

This path keeps cost, privacy risk and false-positive risk lower while still creating useful safety value.

## Provider Abstraction

The detection engine should keep one provider-neutral contract:

```ts
type DetectionInput = {
  imageFrame?: FrameInput;
  videoClip?: ClipInput;
  audioSegment?: AudioInput;
  camera?: CameraContext;
  zone?: ZoneContext;
  rule?: RuleContext;
  childContext?: ChildContext | null;
  staffContext?: StaffContext | null;
  consentContext: ConsentContext;
  budgetContext: BudgetContext;
};
```

Provider output:

```ts
type ObserverDetection = {
  rule_key: string;
  event_type: string;
  confidence: number;
  title: string;
  description: string;
  explanation?: string;
  cost_estimate?: CostEstimate;
  metadata?: Record<string, unknown>;
};
```

The rule engine, not the provider, decides whether to create an event.

## Privacy And Consent Requirements

No AI feature should activate without explicit configuration.

Required consent layers:

- Kindergarten consent.
- Camera AI consent.
- Parent consent where child data/images may be analyzed.
- Staff consent where staff may appear in analysis.
- Audio analysis consent.
- Face recognition consent.

Consent must be granular:

- Camera health only.
- Person/object detection.
- Zone/restricted-area detection.
- Audio anomaly.
- Keyword detection.
- Face recognition.
- External cloud provider processing.

Default state:

- AI disabled.
- Audio disabled.
- Face recognition disabled.
- External provider disabled.

## Data Minimization Policy

Frame sampling:

- Sample only active cameras.
- Skip inactive hours unless emergency mode is enabled.
- Use low-frequency sampling first.
- Increase sampling only for high-risk zones or active incident windows.

Storage:

- Store event metadata, not raw streams.
- Store snapshots/clips only when an event is created and policy allows it.
- Keep storage buckets private.
- Use signed access for review.

Retention:

- Short default retention for snapshots/clips.
- Longer retention only for confirmed/escalated incidents.
- Delete expired media automatically.

Visibility:

- Admin can review global events.
- Manager/owner can review own kindergarten.
- Inspector can review assigned kindergartens.
- Parent sees no raw AI events.
- Parent-facing updates require human approval.

Audit requirements:

- Provider call.
- Frame/clip sampled.
- Event created.
- Event reviewed.
- Clip/snapshot viewed.
- Consent changed.
- Parent visibility changed.

## Cost Control

Protection mechanisms:

- Per-camera rate limits.
- Per-kindergarten monthly AI budget cap.
- Global monthly AI budget cap.
- Sampling interval configuration.
- Skip inactive cameras.
- Skip cameras without consent.
- Cooldown per rule/event type.
- Dedupe repeated events.
- Emergency mode with explicit admin/manager activation.
- Cloud provider disabled unless budget and consent allow it.

Recommended defaults:

- Camera health: frequent local checks.
- Object/person detection: low-frequency local sampling.
- Cloud vision: event validation only.
- Audio: disabled by default.
- Face recognition: disabled by default.

Future env variables:

```env
AI_PROVIDER=
OPENAI_API_KEY=
GEMINI_API_KEY=
AZURE_VISION_KEY=
AWS_REKOGNITION_KEY=
LOCAL_AI_ENDPOINT=
AI_MONTHLY_BUDGET_LIMIT=
AI_FRAME_SAMPLE_INTERVAL_SECONDS=
```

No real keys should be committed.

## Human Review Workflow

All AI events follow this path:

AI suspected
-> Human review
-> Confirm or dismiss
-> Escalate only if needed
-> Notify wider audience only after human approval

No automatic accusations.

Wording rules:

- Use suspected.
- Use indicator.
- Use requires review.
- Avoid definitive blame.
- Avoid parent notification before review.

## Risk Classification

LOW:

- Routine anomaly.
- Camera health warning.
- Low-confidence operational signal.

MEDIUM:

- Possible issue.
- Needs review during normal workflow.
- Example: possible crowding indicator.

HIGH:

- Requires immediate review.
- Example: restricted area entry suspected.

CRITICAL:

- Urgent safety concern.
- Example: fall suspected with high confidence or pickup mismatch suspected.

Severity is advisory until human review.

## Future Testing Plan

Before production provider calls:

- Static image test with no children.
- Synthetic/fake kindergarten scene.
- Sample video clip with non-sensitive actors.
- Mock detection regression.
- False-positive test.
- Cooldown/dedupe test.
- Cost cap test.
- Consent-disabled test.
- External-provider-disabled test.
- Parent-visibility privacy test.
- Audit log test.

Provider pilot tests:

- Local OpenCV camera health.
- Local YOLO person/object detection.
- Cloud vision review enrichment with redacted/non-sensitive frames.
- Audio anomaly test without transcription.

## Remaining Risks

- False positives may create operational noise.
- Cloud providers increase privacy and compliance exposure.
- Audio and face recognition are highly sensitive.
- Kindergarten environments are noisy and visually complex.
- Real-time expectations may exceed practical latency/cost limits.
- Legal consent requirements must be validated before activation.

## Exact Next Implementation Step

Build a local-only pilot detector:

1. Add OpenCV camera health checks to the observer worker.
2. Add local YOLO/Ultralytics person/object detection behind the existing detection engine interface.
3. Keep output as suspected `ai_camera_events`.
4. Keep parents excluded.
5. Run in shadow mode for one pilot kindergarten.
6. Measure false positives, cost, latency and review workload before enabling live alerting.
