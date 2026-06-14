# Digital Observer First Home / Business Pilot Report

This report is a template/readiness artifact for the first standalone Digital Observer pilot.

It does not claim that a real pilot has already succeeded.

## Site Profile

- Site name: TBD
- Site type: home / business / office / warehouse / store / parking_lot / custom
- Owner name: TBD
- City: TBD
- Camera count: TBD
- Camera system: RTSP / ONVIF readiness / DVR / NVR / Hikvision / Dahua / Generic IP Camera / Demo Camera
- Package interest: TBD
- Support owner: TBD

## Camera Setup

Document:

- camera type
- gateway provider
- stream registration result
- playback readiness
- failed stream handling
- reconnect readiness
- whether RTSP stayed server-side
- whether credentials stayed encrypted or server-only

## Gateway Result

Checks:

- gateway health
- source registration
- stream availability
- playback readiness
- reconnect readiness
- latency
- failure handling

Current status:

- Not yet validated against a real external gateway.

## Observer Alerts

Track:

- total detections
- pending review
- confirmed
- dismissed
- uncertain
- needs follow-up

Rules:

- shadow mode only
- no automatic enforcement
- no emergency calls
- no accusations
- no final conclusions without review

## Calibration Findings

Track:

- motion sensitivity
- after-hours sensitivity
- restricted zone sensitivity
- inactivity threshold
- alert threshold
- confidence threshold
- calibration status

Current status:

- Baseline profiles created.
- Real calibration requires real reviewed alerts.

## False Positives

Track:

- count
- event type
- camera
- reason
- lighting issues
- angle issues
- zone definition issues

Common reasons:

- normal movement
- lighting
- camera angle
- object movement
- zone too broad

## False Negatives / Missed Events

Track:

- count
- expected event type
- approximate time
- camera
- notes
- reason if known

## User Feedback

Collect:

- setup difficulty
- camera connection difficulty
- alert usefulness
- false alert frustration
- dashboard clarity
- willingness to pay
- preferred package
- missing features

## Commercial Findings

Track:

- package interest
- trial-to-paid likelihood
- expected monthly price
- expected annual price
- support effort
- camera setup complexity
- ideal customer type

## Technical Blockers

Potential blockers:

- real gateway not connected
- camera stream unavailable
- playback token not validated
- too many false positives
- calibration unstable
- alert delivery provider not configured
- support load too high

## Privacy / Legal Notes

Document:

- site type
- camera policy assumptions
- consent needs
- audio status
- face status
- sensitive capability status

Default:

- audio disabled
- face recognition disabled
- sensitive capabilities blocked unless approved

## Recommended Next Step

Default recommendation before real pilot evidence:

- Continue setup and validation.
- Do not scale until camera playback, gateway health, alert review, feedback and commercial validation are complete.
