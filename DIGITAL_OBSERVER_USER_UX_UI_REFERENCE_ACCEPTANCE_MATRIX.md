# Digital Observer User UX/UI - Reference Acceptance Matrix

Date: 2026-08-22
Scope: standalone Digital Observer home and business product
Reference status: all seven supplied image files were opened and reviewed directly
Data used for QA: synthetic home and business accounts only

## Acceptance rule

The references define the information hierarchy, mobile-first behavior, visual language and expected product surfaces. The implementation may not imitate a live camera, payment, biometric result, external notification or emergency action when the corresponding provider is not connected. In those cases the same surface is implemented as an explicit readiness state.

## 1. Home camera connection

Reference: `/Users/danielderi/Desktop/תצפיתן דיגיטלי/הוספת מצלמה ביתי.png`

| Requirement | Implementation | Evidence | Result |
|---|---|---|---|
| Four-step guided connection | Source, details, monitoring targets, summary | `reference-flows/*-camera-step-*.jpg` | PASS |
| Simple connection choices | QR, vendor app, ONVIF discovery, NVR/DVR, advanced manual, local Gateway, demo | `/digital-observer/cameras/add` | PASS |
| Connection instructions per source | Requirements and ordered steps change with the selected connector | `ObserverCameraWizard` | PASS |
| Camera name and location | Data-bound form fields | camera step 2 evidence | PASS |
| Monitoring targets | Person, unknown person, animal, entry/exit, vehicle, distress, rooms, obstruction and more | camera step 3 evidence | PASS |
| Preview/live state | Demo preview is explicitly marked; real live view requires Gateway and a short token | `/digital-observer/cameras` | READINESS_PASS |
| Responsive behavior | Mobile single-column wizard and desktop guided workspace | 390 and 1440 flow evidence | PASS |

## 2. Business dashboards

Reference: `/Users/danielderi/Desktop/תצפיתן דיגיטלי/דשבורד עסקי.png`

| Requirement | Implementation | Evidence | Result |
|---|---|---|---|
| Business overview | General status, active/inactive cameras, open events, after-hours mode | business dashboard screenshots | PASS |
| Data-bound activity graph | Six four-hour buckets derived from site signal timestamps | `activityBuckets(siteSignals)` | PASS |
| Sites/branches | Separate cards with cameras, open events and subscription state | `/digital-observer/sites` | PASS |
| Camera grid and state | Source status, health, detail and readiness controls | `/digital-observer/cameras` | PASS |
| Team and permissions | Owner and alert recipients are separated; permission matrix never grants fake app access | `/digital-observer/people` | PASS_WITH_GUARDRAIL |
| Desktop hierarchy | Fixed RTL sidebar, top controls, aligned metrics and two-column command area | 1366/1440 evidence | PASS |
| Mobile hierarchy | Mobile header, full drawer and bottom navigation; cards rebuild to one/two columns | 390/430 evidence | PASS |

## 3. Alerts, event detail, recordings and known people

Reference: `/Users/danielderi/Desktop/תצפיתן דיגיטלי/הקלטות, אנשים מוכרים, מרכז התראות, פרטי אירוע.png`

| Requirement | Implementation | Evidence | Result |
|---|---|---|---|
| Severity filters | All, critical, urgent and warning | `/digital-observer/alerts` | PASS |
| Event detail first on mobile | Selected event appears before the event list below 820px | mobile alerts evidence | PASS |
| Confidence and human decision | Confidence, recommendation, confirm, dismiss/calibrate and escalate-to-review | event detail | PASS |
| No fake evidence | Missing event media shows a truthful no-preview state | event detail | PASS |
| Recordings | Responsive clip rows, captured time, duration, retention and availability | `/digital-observer/recordings` | PASS |
| Safe download | No active download without a real file and signed URL | recordings page | PASS |
| Frequent-person candidates | AI candidate workflow, repeated observations, explicit human choice | `/digital-observer/people` | PASS |
| Child privacy mode | Skeleton/movement-only mode blocks face enrolment | known people page | PASS |

## 4. Mobile app and notifications

Reference: `/Users/danielderi/Desktop/תצפיתן דיגיטלי/חידוד לאיך נראה המובייל + התראות  לנייד.png`

| Requirement | Implementation | Evidence | Result |
|---|---|---|---|
| App-like mobile shell | Centered title, hamburger, alert control, raised Observer action and bottom nav | mobile screenshots and menu evidence | PASS |
| Every route accessible | Compact nav plus full role-specific drawer | `ObserverAppShell` | PASS |
| No bottom-nav overlap | Content includes safe-area bottom clearance | all mobile layout checks | PASS |
| Live camera actions | Readiness controls are visible but do not claim live operation | camera screenshots | READINESS_PASS |
| Push lock-screen alert | Provider and native push are not activated | settings | EXTERNAL_PROVIDER_REQUIRED |
| Accessible zoom | Viewport metadata does not disable pinch zoom | automated QA | PASS |

## 5. Subscription, billing, profile and management

Reference: `/Users/danielderi/Desktop/תצפיתן דיגיטלי/תשלומים, מנויים וניהול מערכת.png`

| Requirement | Implementation | Evidence | Result |
|---|---|---|---|
| Current subscription | Server status, trial end and entitlements | `/digital-observer/billing` | PASS |
| Monthly/annual choice | Segmented cycle control using database monthly/annual prices | billing screenshots | PASS |
| Home/business separation | Home sees home plans; business sees business/enterprise plans; API enforces it | automated QA | PASS |
| No fake payment | Plan action creates a no-charge mock request only | billing page and API QA | PASS |
| Profile/settings | Account type, notification modes, quiet hours, recipients, device slots and account actions | `/digital-observer/settings` | PASS |
| Admin control center | Implemented under `/digital-observer/admin` in the preceding approved admin phase | existing admin QA | PASS_EXISTING |
| Real card/invoice stores | Not activated in this phase | billing readiness notice | EXTERNAL_PROVIDER_REQUIRED |

## 6. Registration and login

Reference: `/Users/danielderi/Desktop/תצפיתן דיגיטלי/רישום והתחברות ביתי ועסקי.png`

| Requirement | Implementation | Evidence | Result |
|---|---|---|---|
| Standalone product login | Dedicated Digital Observer auth route and product-scoped redirect | public login evidence | PASS |
| Home/business selection | Explicit account type before account creation | public account-type evidence | PASS |
| Product separation | Auth does not route a Digital Observer user into Gan Batuach kindergarten onboarding | prior auth E2E and current QA | PASS |
| Home/business onboarding | Separate copy, templates, targets and package choices | 32 reference-flow screenshots | PASS |
| Email verification/recovery | Completed and verified in the preceding auth E2E phase | existing auth reports | PASS_EXISTING |

## 7. Overall home/business language

Reference: `/Users/danielderi/Desktop/תצפיתן דיגיטלי/דשבורד ביתי.png`

| Requirement | Implementation | Evidence | Result |
|---|---|---|---|
| Immediate status | Trial, camera count, open-event count and honest monitoring state | home dashboard | PASS |
| Camera-first home | Camera appears before secondary dashboard sections | home dashboard screenshots | PASS |
| Observer as the center | Live intelligence summary plus natural-language conversation | dashboard and `/digital-observer/rules` | PASS |
| Data-bound insights | Entry/exit, unknown people, vehicles and unusual events derive from site signals | runtime QA | PASS |
| Calm trusted visual language | Navy, teal, white, compact cards and image-backed camera surfaces | all evidence | PASS |
| Not a scaled desktop | Separate mobile header, drawer, nav, card geometry and content ordering | six-viewport QA | PASS |

## Known intentional differences from the references

1. A real video player is not shown when no authorized Gateway stream exists.
2. Real biometric recognition remains disabled; known-person records and candidates stay consent/review based.
3. Real card billing, App Store, Google Play, invoices, Push, SMS, WhatsApp and emergency calling remain disabled.
4. Alert recipients are not presented as authenticated team members. A separate secure team-invitation backend is still required before granting account access.
5. Dynamic synthetic data replaces decorative fixed counts and dates, so exact numbers differ from the reference images.

Visual recommendation: **READY_FOR_STAKEHOLDER_VISUAL_REVIEW_WITH_LIVE_INTEGRATIONS_EXCLUDED**.
