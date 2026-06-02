# Digital Observer Monetization Model

This document defines the future standalone Digital Observer package model.

Gan Batuach is separate:

- Fixed Gan Batuach price: 700 ILS per kindergarten per month.
- Includes the kindergarten management system.
- Includes the Digital Observer as part of the kindergarten package.
- No separate observer upsell should be shown to kindergarten managers at this stage.
- Kindergarten-facing wording should use: "תצפיתן דיגיטלי כלול", "מצלמות ותובנות בטיחות", "ניטור בטיחות כחלק מהמערכת".

The standalone Digital Observer is a future product for homes, businesses, warehouses, offices, stores, parking lots and custom sites.

## Package Examples

| Package | Target | Camera Limit | Monitoring | Event Retention | Recording Retention | Alerts | Pricing |
| --- | --- | ---: | --- | ---: | ---: | --- | --- |
| Home Basic | Homes | 2 | Event-only | 14 days | 0 days | In-app only | Placeholder |
| Home Plus | Homes | 6 | Night-only | 30 days | 7 days | SMS / WhatsApp ready | Placeholder |
| Business Basic | Small businesses, stores, offices | 8 | Business hours | 30 days | 7 days | SMS / WhatsApp ready | Placeholder |
| Business Pro | Businesses, warehouses, parking lots | 20 | Custom schedule | 60 days | 14 days | SMS / WhatsApp ready | Placeholder |
| Enterprise Monitoring | Enterprise / custom | Custom | 24/7 | 180 days | 30 days | Custom SLA | Custom |

All packages require human review for safety events. No automatic accusations or parent-facing raw AI output are allowed.

## Package Controls

Each standalone package can control:

- Camera limit
- Monitoring hours
- Event retention days
- Recording retention days
- AI event types enabled
- Live view
- AI shadow detection
- Safety event detection
- Recording
- Snapshots
- WhatsApp alerts
- SMS alerts
- Advanced analytics
- Multi-user access

## Monitoring Hours

Supported monitoring modes:

- 24/7 monitoring
- Custom schedule
- Night only
- Business hours
- Event-only mode

Each site stores:

- Schedule JSON
- Timezone
- Active days
- Active hours

## Site Subscription Relationship

Each future standalone observer site can have:

- Package
- Subscription status
- Trial start
- Trial end
- Renewal date
- Suspended date
- Cancellation reason
- Override limits

Statuses:

- trial
- active
- pending_payment
- expired
- suspended
- cancelled

Kindergarten observer sites should not be assigned standalone packages by default because Digital Observer is included in Gan Batuach.

## Usage Tracking

Usage snapshots prepare future billing and limit enforcement:

- Active cameras
- AI events this month
- Storage used
- Monitoring hours used
- SMS alerts sent
- WhatsApp alerts sent
- Playback sessions

Current implementation stores the foundation. Real billing provider integration is not included yet.

## Limits Enforcement Readiness

Future checks:

- Cannot add camera beyond package limit
- Monitoring disabled if subscription expired
- Recording disabled if package does not include recording
- AI event types limited by package
- Alerts limited by package

Important: these checks must only apply to standalone observer sites unless explicitly designed otherwise. Gan Batuach kindergarten flows must not be blocked by standalone observer package limits.

## Trial Path

Future trial flow:

1. Site owner starts trial.
2. Package assigned with trial status.
3. Trial expiration reminders are sent through in-app notifications first.
4. SMS / WhatsApp reminders can be added when providers are connected.
5. Trial converts to paid plan or becomes pending_payment / expired.

## Upsell Path

Standalone observer upsell can be based on:

- More cameras
- More monitoring hours
- Longer event retention
- Recording retention
- Advanced analytics
- SMS / WhatsApp alerts
- Enterprise SLA

Do not use this upsell language inside Gan Batuach kindergarten manager flows.

## Remaining Billing Provider Work

- Payment provider adapter connection
- Invoice / receipt provider connection
- Automatic renewal jobs
- Failed payment handling
- Subscription reminders
- Real storage usage metering
- Real monitoring hours calculation
- Real SMS / WhatsApp sent-count aggregation
- Customer-facing standalone site owner dashboard
