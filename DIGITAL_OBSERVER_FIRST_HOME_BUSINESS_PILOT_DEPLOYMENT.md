# Digital Observer First Home / Business Pilot Deployment

Phase 179 prepares the first standalone Digital Observer pilot for a home, small business or private monitored site.

This pilot is independent from Gan Batuach. It must not use kindergarten, child, parent, staff or inspector data.

## Pilot Architecture

Digital Observer pilot uses the existing shared infrastructure:

- `observer_sites`
- `camera_streams`
- `camera_gateway_configs`
- `observer_intelligence_signals`
- `observer_ground_truth_reviews`
- `observer_calibration_profiles`
- `observer_site_subscriptions`
- audit logs
- notification provider readiness
- package and billing readiness

Phase 179 adds a standalone pilot layer:

- `digital_observer_pilot_sites`
- `digital_observer_pilot_gateway_checks`
- `digital_observer_pilot_alert_reviews`
- `digital_observer_pilot_calibration_profiles`
- `digital_observer_pilot_support_issues`
- `digital_observer_pilot_feedback`
- `digital_observer_pilot_commercial_validation`
- `digital_observer_pilot_legal_notes`
- `digital_observer_pilot_readiness_snapshots`

## Pilot Site Types

Supported pilot site types:

- home
- business
- office
- warehouse
- store
- parking_lot
- custom

## Site Setup Flow

Home pilot:

1. create test site
2. choose camera type
3. enter RTSP / DVR / NVR / IP camera details server-side
4. test gateway
5. register camera
6. verify playback
7. enable observer shadow mode
8. review alerts

Business pilot:

1. create business site
2. choose monitoring schedule
3. configure cameras
4. define restricted zones
5. configure alert recipients
6. enable test monitoring
7. review observer alerts
8. collect feedback

## Camera Setup Flow

Camera system readiness:

- RTSP
- ONVIF readiness
- DVR
- NVR
- Hikvision
- Dahua
- Generic IP Camera
- Demo Camera

The pilot does not require all camera systems to be production-ready. Gaps must be documented honestly.

## Gateway Test Flow

Gateway validation checks:

- gateway health
- source registration
- stream availability
- playback readiness
- failed stream handling
- reconnect readiness

Provider readiness:

- MediaMTX
- go2rtc
- custom gateway

Security rules:

- RTSP URL is server-side only
- credentials are encrypted or server-only
- no camera secrets in browser
- no gateway secret exposure
- playback uses secure token readiness
- stream sessions are audited

## Alert Review Flow

Lifecycle:

detected
→ pending_review
→ dismissed / confirmed / needs_followup / uncertain
→ action_suggested
→ closed

Reviewer roles:

- admin
- site owner
- observer reviewer

AI may:

- detect
- recommend
- create internal review event

AI may not:

- trigger automatic enforcement
- call emergency services
- make accusations
- create final conclusions without review

## Shadow Mode

All pilot detections start with:

- `shadow_mode = true`
- `human_review_required = true`
- `automatic_action_taken = false`

Restricted capabilities remain blocked unless approved through the capability matrix.

Do not enable by default:

- audio analytics
- face recognition
- face matching
- gait recognition
- soft biometric matching

## Calibration Flow

Calibration is tracked per pilot site and optionally per camera/zone/event type.

Tracked thresholds:

- motion sensitivity
- after-hours sensitivity
- restricted zone sensitivity
- inactivity threshold
- alert threshold
- confidence threshold

Calibration statuses:

- not_started
- collecting_data
- needs_review
- calibrated
- unstable
- paused

## False Positive / False Negative Tracking

Track:

- false positives
- missed events
- uncertain events
- detection quality
- camera quality
- lighting issues
- camera angle issues
- zone definition issues

Use findings for calibration. Do not treat a pilot alert as a final conclusion without review.

## Site Owner Experience

The owner dashboard should show:

- site health
- cameras
- alerts
- monitoring schedule
- package status
- setup progress
- recent events
- support contact
- recommended next actions

Camera cards should show:

- camera name
- status
- last checked
- monitoring mode
- open view
- test connection
- needs attention

Technical details remain hidden unless an admin or advanced mode is used.

## Support Workflow

Support categories:

- camera connection
- gateway issue
- playback issue
- alert issue
- billing/trial issue
- onboarding issue
- UX confusion
- feature request

Lifecycle:

open
→ triaged
→ in_progress
→ fixed
→ verified
→ closed

## Trial / Package Validation

Validate:

- trial started
- package selected
- usage tracked
- camera limits
- alert limits
- upgrade prompt
- billing readiness

No real charge should occur unless payment mode is explicitly enabled.

## Billing Separation

Digital Observer payments are separate from:

- Gan Batuach kindergarten subscriptions
- parent tuition payments
- kindergarten payout configuration

No mixed invoices.

No mixed revenue reporting.

## Feedback Collection

Collect site owner feedback:

- setup difficulty
- camera connection difficulty
- alert usefulness
- false alert frustration
- dashboard clarity
- willingness to pay
- preferred package
- missing features

## Commercial Validation

Track:

- package interest
- trial-to-paid likelihood
- expected monthly price
- expected annual price
- support effort
- camera setup complexity
- ideal customer type

## Privacy & Legal Notes

For every non-kindergarten pilot document:

- site type
- capabilities enabled
- legal assumptions
- consent needs
- camera policy needs
- audio capability status
- face capability status

Sensitive capabilities must not be enabled without explicit capability matrix approval.

## Remaining Standalone Product Gaps

- real gateway connection must be configured
- real camera playback must be validated
- provider sending mode must remain controlled
- payment mode must remain disabled/sandbox unless approved
- legal review is still recommended before scale-up
- self-service account creation can be tightened after pilot results
- external analytics can be added only if approved
