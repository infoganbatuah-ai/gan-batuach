# Gan Batuach V2 Roadmap

This roadmap defines the official V2 direction for Gan Batuach. It is a planning document only. It does not authorize implementation without product, technical and commercial review.

Complexity levels:

- LOW: mostly configuration, UI extension or small backend addition
- MEDIUM: new workflows or integrations with limited risk
- HIGH: significant backend, security, data model or operational impact
- VERY HIGH: infrastructure-heavy, regulated, AI/video, payment or native-platform work

## Recommended V2 Implementation Order

1. Phase 2A: production communication, subscription foundations and mobile packaging
2. Phase 2B: subscription automation, push notifications, workforce platform and advanced analytics foundations
3. Phase 2C: video gateway, recording readiness, government/compliance exports and external API platform
4. Phase 2D: AI Digital Observer and future standalone observer product

Rationale:

- Communication and billing unlock customer operations and revenue first.
- Mobile apps should package the existing web platform before adding native-only features.
- Video gateway must be production-grade before AI camera analysis.
- AI observer should start after data, camera health, permissions and incident workflows are stable.

---

# Phase 2A: Communication, Pilot Revenue And Mobile Packaging

Goal: make the platform operational for real customers with reliable communication, manual-to-semi-automated subscription flows and first native packaging.

## 2A.1 SMS Integration

Business value:

- Improves account verification, password reset reliability and urgent communication.
- Reduces support load for login and onboarding issues.
- Creates a trusted emergency channel independent of app usage.

Scope:

- phone verification
- password reset codes
- parent onboarding reminders
- payment reminders
- critical alerts
- emergency messages

Technical complexity: MEDIUM

Dependencies:

- verified phone fields
- message templates
- consent/opt-out policy
- provider selection
- audit logs

Recommended order:

1. provider selection
2. server-only SMS API wrapper
3. verification/password reset
4. reminders/alerts
5. emergency broadcast rules

## 2A.2 WhatsApp Integration

Business value:

- Parents and kindergarten managers already use WhatsApp daily.
- Improves onboarding completion and request visibility.
- Can increase response speed for inspection and payment reminders.

Scope:

- parent onboarding links
- parent notifications
- kindergarten manager notifications
- inspection notifications
- subscription reminders
- template-based outbound messages

Technical complexity: HIGH

Dependencies:

- WhatsApp Business provider
- approved templates
- opt-in tracking
- rate limits
- notification routing model
- action URLs

Recommended order:

1. template catalog
2. opt-in and consent model
3. outbound notification wrapper
4. parent onboarding reminders
5. manager/inspection/subscription reminders

## 2A.3 Subscription Foundation

Business value:

- Converts pilot usage into recurring revenue.
- Gives admin/owner clear commercial status.
- Supports grace periods before suspension.

Scope:

- monthly plans
- annual plans
- trial period
- manual invoice/receipt tracking
- grace period
- subscription reminders
- suspension/reactivation status

Technical complexity: MEDIUM

Dependencies:

- kindergarten account lifecycle
- billing contact fields
- notification center
- audit logs
- role permissions

Recommended order:

1. subscription status model
2. admin subscription screen
3. reminders
4. grace period
5. suspension/reactivation workflow

## 2A.4 Android Packaging

Business value:

- Gives staff and managers a simple app install path.
- Improves perceived product maturity.
- Supports future push notifications.

Scope:

- Capacitor Android project
- package name
- app icon and splash
- login/session smoke tests
- upload/photo tests

Technical complexity: MEDIUM

Dependencies:

- `CAPACITOR_SERVER_URL`
- Android Studio setup
- brand assets
- mobile smoke test checklist

Recommended order:

1. install Capacitor packages
2. generate Android project
3. configure icon/splash
4. test login/upload/camera pages
5. prepare signed pilot build

## 2A.5 iPhone Packaging

Business value:

- Covers parents and managers using iPhones.
- Required for serious customer pilots in Israel.
- Supports future Face ID, Touch ID and push notifications.

Scope:

- Capacitor iOS project
- bundle id
- app name
- Xcode signing
- icon and splash
- login/session smoke tests

Technical complexity: MEDIUM

Dependencies:

- Mac + Xcode
- Apple Developer account
- `CAPACITOR_SERVER_URL`
- brand assets

Recommended order:

1. install Capacitor iOS package
2. generate iOS project
3. configure signing
4. test login/upload/camera pages
5. prepare TestFlight pilot

---

# Phase 2B: Automation, Workforce And Analytics

Goal: deepen customer value after the first pilot by automating billing, adding push and expanding staff operations.

## 2B.1 Push Notifications

Business value:

- Makes the product feel alive.
- Reduces missed requests, approvals and urgent incidents.
- Supports real-time parent and staff behavior.

Scope:

- Android push
- iOS push
- web push
- device token storage
- role-aware delivery
- action routing through existing `action_url`

Technical complexity: HIGH

Dependencies:

- mobile apps
- notification center
- device token table
- FCM/APNs credentials
- opt-in and notification preferences

Recommended order:

1. device token model
2. web push pilot
3. Android FCM
4. iOS APNs
5. role/action routing
6. notification preferences

## 2B.2 Subscription Automation

Business value:

- Reduces admin work.
- Supports recurring revenue.
- Makes failed payment handling reliable.

Scope:

- automatic renewals
- invoices
- receipts
- failed payment handling
- grace period automation
- subscription reminders
- suspension/reactivation automation

Technical complexity: HIGH

Dependencies:

- payment provider selection
- subscription foundation
- finance dashboard
- notification center
- legal invoice requirements

Recommended order:

1. provider selection
2. invoice/receipt data model
3. renewal jobs
4. failed payment flow
5. suspension/reactivation automation

## 2B.3 Workforce Platform

Business value:

- Helps kindergartens manage staff continuity and compliance.
- Creates owner-level operational value beyond child management.
- Supports staff transfer history across kindergartens.

Scope:

- staff history
- staff transfers
- performance records
- attendance
- shift planning
- leave requests
- staff document compliance

Technical complexity: HIGH

Dependencies:

- staff permanent file
- staff-kindergarten employments
- role permissions
- notification center
- audit logs

Recommended order:

1. staff permanent file UX
2. transfer/employment views
3. attendance improvements
4. shift planning
5. leave requests
6. performance records

## 2B.4 Advanced Analytics Foundation

Business value:

- Gives owners/admins measurable operating insight.
- Helps identify churn, risk and staffing/payment patterns.
- Supports sales and customer success.

Scope:

- kindergarten analytics
- inspection analytics
- parent engagement
- staff analytics
- financial analytics
- unresolved workflow metrics

Technical complexity: MEDIUM

Dependencies:

- consistent event/timeline data
- smart insights
- payment statuses
- inspection records
- notification/request status tracking

Recommended order:

1. analytics event definitions
2. manager/owner dashboards
3. admin platform analytics
4. parent engagement metrics
5. financial analytics

---

# Phase 2C: Video, Compliance And Platform APIs

Goal: build production infrastructure for real camera connectivity, compliance reporting and external integrations.

## 2C.1 Video Gateway

Business value:

- Turns camera module from configuration/demo into real infrastructure.
- Enables safe parent viewing without exposing camera credentials.
- Becomes foundation for AI Digital Observer.

Supported sources:

- DVR
- NVR
- RTSP
- ONVIF
- IP Cameras

Streaming:

- HLS
- WebRTC

Technical complexity: VERY HIGH

Dependencies:

- camera inventory
- encrypted camera credentials
- playback token model
- video session logs
- gateway hosting
- health checks
- support process

Recommended order:

1. gateway proof of concept
2. RTSP/HLS support
3. ONVIF discovery
4. DVR/NVR support
5. WebRTC support
6. operational health monitoring
7. parent playback pilot

## 2C.2 Camera Health Monitoring

Business value:

- Reduces silent camera failures.
- Gives managers/admins trust in camera status.
- Supports SLA and support operations.

Scope:

- last seen
- connection status
- stream activity
- uptime
- failures
- reconnect attempts
- offline notifications

Technical complexity: HIGH

Dependencies:

- video gateway
- camera health schema
- notification center
- admin camera audit

Recommended order:

1. gateway health callback
2. camera health timeline
3. manager/admin alerts
4. uptime reports

## 2C.3 Recording Architecture

Business value:

- Enables incident review and later AI event verification.
- Supports premium camera monitoring services.
- Creates audit trail when legally permitted.

Scope:

- recording enabled flag
- retention policies
- archive policies
- clip metadata
- event-linked clips
- role-based viewing permissions

Technical complexity: VERY HIGH

Dependencies:

- legal/privacy policy
- video gateway
- secure storage/archive service
- retention rules
- consent model

Recommended order:

1. legal/privacy review
2. metadata schema
3. retention policy engine
4. event clip linking
5. manager/admin viewing UX

## 2C.4 Government Integration

Business value:

- Reduces compliance workload.
- Makes the platform more valuable for regulated operations.
- Supports inspection transparency.

Scope:

- Ministry of Education exports
- inspection reporting
- compliance reporting
- document status exports

Technical complexity: HIGH

Dependencies:

- official export formats
- compliance data mapping
- inspection reports
- document records
- audit logs

Recommended order:

1. identify required formats
2. build export templates
3. admin review flow
4. pilot with one kindergarten

## 2C.5 API Platform

Business value:

- Enables integrations with accounting, CRMs, inspection partners and future mobile/native services.
- Creates platform defensibility.

Scope:

- future APIs
- webhooks
- external integrations
- API keys
- tenant-scoped access
- audit logs

Technical complexity: HIGH

Dependencies:

- RBAC and tenant isolation
- API key management
- rate limiting
- webhook signing
- documentation

Recommended order:

1. API standards
2. webhook signing
3. read-only pilot endpoints
4. event webhooks
5. partner integrations

---

# Phase 2D: AI Digital Observer And Standalone Observer Platform

Goal: evolve from operational assistant to proactive AI monitoring while preserving privacy, human review and trust.

## 2D.1 AI Digital Observer Foundation

Business value:

- Surfaces safety risks automatically.
- Reduces dependency on manual camera watching.
- Creates a premium product tier.

Capabilities:

- abnormal activity
- restricted areas
- fall detection
- crowding
- gate/door open
- unauthorized person
- missing child
- pickup identification
- face recognition
- audio anomaly detection
- distress indicators
- violence indicators
- keyword detection
- timeline reconstruction

Technical complexity: VERY HIGH

Dependencies:

- video gateway
- recording/clip architecture
- consent and privacy model
- incident workflow
- notification/escalation rules
- AI provider/model pipeline

Recommended order:

1. event schema and human review
2. camera clip capture
3. limited detection types
4. manager/admin review workflow
5. escalation and notification rules
6. false-positive tuning

## 2D.2 Machine Learning Routine Models

Business value:

- Reduces false positives.
- Learns each kindergarten's normal day.
- Detects unusual patterns that static rules miss.

Scope:

- learn kindergarten routine
- reduce false positives
- identify recurring patterns
- adaptive behavior models
- per-kindergarten thresholds

Technical complexity: VERY HIGH

Dependencies:

- event history
- recording clips
- anonymization/privacy controls
- model evaluation loop
- enough production data

Recommended order:

1. collect labeled events
2. define normal-routine baselines
3. false-positive dashboard
4. adaptive thresholds
5. recurring pattern reports

## 2D.3 AI Incident Workflow

Business value:

- Turns AI detection into operational action.
- Prevents alert fatigue.
- Creates auditable safety process.

Workflow:

Detection -> Record clip -> Create event -> Notify users -> Escalate if needed

Scope:

- detection confidence
- clip attachment
- event severity
- manager review
- inspector/admin escalation
- parent notification only when appropriate
- timeline reconstruction

Technical complexity: HIGH

Dependencies:

- AI observer foundation
- recording architecture
- notification center
- incident module
- audit logs

Recommended order:

1. AI event queue
2. human review state
3. incident creation
4. escalation rules
5. timeline view

## 2D.4 Native App Enhancements

Business value:

- Improves mobile trust and speed.
- Makes the app feel native to parents/staff/managers.

Scope:

- Face ID
- Touch ID
- Push notifications
- native uploads
- secure local session bridge if needed

Technical complexity: MEDIUM to HIGH

Dependencies:

- Android/iOS packaging
- push notification infrastructure
- auth/session testing
- native permission model

Recommended order:

1. push notifications
2. native upload polish
3. biometric unlock
4. secure storage/session bridge if needed

---

# Future Standalone Digital Observer Product

Goal: create a separate product line using the same observer engine beyond kindergartens.

## Product Concept

The Digital Observer can become a standalone AI monitoring platform for camera-based environments.

Markets:

- homes
- businesses
- warehouses
- offices
- parking lots
- kindergartens

Business value:

- Expands market beyond kindergarten management.
- Creates subscription revenue from AI security monitoring.
- Reuses camera gateway, observer engine, notification routing and incident workflows.

Technical complexity: VERY HIGH

Dependencies:

- production video gateway
- recording/retention architecture
- AI observer models
- billing/subscription platform
- standalone tenant model
- legal/privacy/compliance review

Subscription model:

- per camera
- per location
- per monitoring tier
- retention add-on
- emergency escalation add-on
- business analytics add-on

Services:

- camera monitoring service
- AI security monitoring service
- event timeline and clip archive
- escalation to owner/security/contact
- compliance and incident reports

Recommended order:

1. validate kindergarten observer engine
2. extract reusable observer services
3. define standalone tenant model
4. create pilot with non-kindergarten environment
5. launch subscription tiers

---

# Cross-Cutting Requirements

## Security And Privacy

- Never expose camera credentials.
- Keep service role server-only.
- Keep tenant isolation strict.
- Add consent and privacy controls before AI/recording expansion.
- Keep audit logs for sensitive actions.

Complexity: HIGH

## Legal And Compliance

- Review camera recording policy.
- Review face recognition policy.
- Review audio analysis policy.
- Review parental consent and employee consent.
- Review government reporting obligations.

Complexity: VERY HIGH

## Operational Readiness

- Support playbooks
- Monitoring
- Backup/restore drills
- Incident escalation
- Customer success metrics

Complexity: MEDIUM

---

# Summary By Phase

Phase 2A:

- SMS integration
- WhatsApp integration
- subscription foundation
- Android packaging
- iPhone packaging

Primary value: production communication and first revenue readiness

Phase 2B:

- push notifications
- subscription automation
- workforce platform
- advanced analytics

Primary value: operational automation and customer retention

Phase 2C:

- video gateway
- camera health
- recording architecture
- government integration
- API/webhook platform

Primary value: infrastructure depth and compliance

Phase 2D:

- AI Digital Observer
- machine learning routine models
- AI incident workflow
- native enhancements
- standalone observer product

Primary value: differentiated AI safety and new market expansion
