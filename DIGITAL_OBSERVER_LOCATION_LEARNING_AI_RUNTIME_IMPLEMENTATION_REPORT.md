# Digital Observer - Location, Learning and Runtime Implementation Report

Date: 2026-08-21

## Result

The standalone Digital Observer now has a real data-bound foundation for structured location, a 30-day learning lifecycle, reviewed anomaly feedback, watch requests, authorized recipients and a two-device limit. The Supabase migration was applied and verified in project `gan-batuah` (`kuaywzvucllxjsxarogb`).

Live camera ingestion, live AI inference, production notifications and emergency calling remain disabled. They require real provider credentials, a camera gateway, operational validation and legal/policy approval.

## Implemented

### Structured location

- Added city, street, building, apartment, ground/floor and floor number fields.
- Added provider place ID, formatted address, latitude and longitude for a future admin map and regional statistics.
- Added server-only Google Places (New) autocomplete and place resolution routes.
- A manually edited address invalidates any previous provider verification.
- Emergency calling remains blocked when the address is unverified.

Main files:

- `components/digital-observer/observer-address-fields.tsx`
- `lib/domain/digital-observer/address-provider.ts`
- `app/api/digital-observer/address/autocomplete/route.ts`
- `app/api/digital-observer/address/resolve/route.ts`
- `app/api/digital-observer/onboarding/route.ts`

### Privacy mode

- Home and ordinary business accounts remain in consent-gated standard mode.
- A business that handles children is forced to `skeleton_only`.
- Known-person/face-recognition setup is blocked for child-focused sites.
- Raw camera credentials, RTSP addresses and provider secrets are not accepted in the browser.

### Learning runtime

- Adding a camera initializes a site-scoped 30-day learning profile.
- Six baseline categories are created: occupancy, movement, activity, active hours, camera activity and zone use.
- The UI derives progress and status from stored runtime data instead of fake counts.
- Reviewing an event records a learning feedback signal.
- Marking an event as acceptable adjusts that event pattern only; it never creates a global whitelist.
- Human review remains mandatory and automatic accusations remain prohibited.

Main files:

- `app/api/digital-observer/cameras/route.ts`
- `app/api/digital-observer/events/review/route.ts`
- `app/digital-observer/rules/page.tsx`
- `lib/domain/digital-observer/runtime.ts`

### My Observer

`/digital-observer/rules` now presents:

- real camera inventory and truthful demo/readiness media states;
- learning progress and baseline maturity;
- recent reviewed signals and confidence;
- a chat-like watch request form;
- structured location and emergency-readiness status;
- clear provider/Gateway blockers when live execution is unavailable.

No fake live video, fake AI activity or synthetic result is presented as a real event.

### Authorized recipients and devices

- Authorized recipients can be configured with encrypted server-side contact storage.
- Browser reads receive only a masked destination hint.
- Provider contact references are excluded at database-column permission level.
- Each site is limited to two active device slots by a database trigger.
- Device identifiers are stored as hashes, not raw push/device secrets.
- External delivery remains disabled until a provider is configured and approved.

Main files:

- `app/api/digital-observer/access-settings/route.ts`
- `components/digital-observer/observer-action-forms.tsx`
- `app/digital-observer/settings/page.tsx`

### Service truthfulness

Provider readiness now rejects placeholder values such as `your-domain`, `replace-with`, mock and disabled modes. A sample URL or sample secret can no longer make the product appear connected.

## Database

Migration:

- `supabase/migrations/20260821000300_digital_observer_location_learning_runtime.sql`

New tables:

- `digital_observer_authorized_recipients`
- `digital_observer_device_slots`

New RPCs:

- `initialize_digital_observer_learning(uuid)`
- `record_digital_observer_feedback(uuid, text, text)`

Schema verification returned `true` for location columns, both new tables and both RPCs.

## QA

Automated Digital Observer QA: **35/35 PASS**.

Passed areas include:

- normal Supabase login for home and business QA users;
- standalone Digital Observer identity metadata;
- site-scoped cameras, events, subscription readiness, known people, event clips and mock notifications;
- cross-tenant RLS isolation in both directions;
- maximum 48-hour retention;
- no package activating live providers;
- complete home/business package matrix.

Evidence:

- `DIGITAL_OBSERVER_AUTOMATED_QA_RESULTS.md`
- `scripts/qa/check-digital-observer-product.mjs`
- `scripts/qa/seed-digital-observer-runtime.sql`

## Still Required For Live Operation

1. Google Maps Platform key restricted to Places API and server use.
2. A real on-premise/edge camera Gateway and one synthetic-safe real camera test.
3. An AI inference worker/provider running in shadow mode with reviewed outputs.
4. Production email, Push, SMS, WhatsApp and voice adapters with delivery logs and idempotency.
5. A legally and operationally approved emergency escalation flow. The product must not call an emergency service automatically before this approval.
6. Explicit biometric consent outside child-focused sites. Child-focused sites remain skeleton-only.
7. Native Push registration and real-device QA after Capacitor sync.

## Current Recommendation

`READY_FOR_DEPLOYED_INTERNAL_RUNTIME_REVIEW`

This is not approval for production camera monitoring, automatic emergency calls or a public pilot with real private video.
