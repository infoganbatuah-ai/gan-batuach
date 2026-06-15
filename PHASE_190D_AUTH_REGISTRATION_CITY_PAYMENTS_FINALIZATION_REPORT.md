# PHASE 190D Auth, Registration, City Data & Subscription Finalization Report

Date: 2026-06-16

## 190C App Shell Preservation
Verified:

- `/app` exists and remains the app gateway.
- `DashboardShell` remains the shared internal app shell.
- Public website routes remain marketing/information routes.
- No internal dashboard route was removed.
- No redirect was added.

## Login UX Status
Updated `/login` to feel more app-like:

- Clear title: `כניסה למערכת גן בטוח`.
- Clear trust/use sentence.
- Existing email/password flow preserved.
- Added loading/disabled submit button through `LoginSubmitButton`.
- Added `שכחת סיסמה?` link.
- Added secondary registration link.
- Kept Passkey/WebAuthn surface only where existing component already exists.

Not added intentionally:

- Google login.
- Apple login.
- Any external OAuth provider.
- Fake Face ID / biometric button.

## Register UX Status
Updated `/register` and `SelfServiceRegisterForm`:

- Role-card selection: parent, kindergarten manager, staff, inspector.
- Focused form updates based on selected role.
- Password confirmation validation.
- Terms/privacy consent checkbox.
- Role-specific neutral data-use explanation.
- Uses existing `/api/self-service/register` endpoint.

No duplicate user model was created.

## Role Forms Status
Implemented UI-level focused fields:

- Parent: full name, phone, email, optional ID number, password, confirm password, terms approval.
- Staff: full name, phone, email, ID number, previous experience, password, confirm password, terms approval.
- Inspector: full name, phone, email, ID number, city, preferred regions, experience summary, password, confirm password, terms approval.
- Kindergarten manager: full name, phone, email, ID number, city, password, confirm password, terms approval.

Important:

- The existing API currently persists core registration fields and keeps the user in a pending/limited state.
- Extra role-specific fields are UI/readiness fields unless already supported downstream.

## City / Location Data Status
Reused existing `israeliCityStreetMap`.

Added:

- `knownKindergartenCities()`.
- `operationalDistrictForCity()`.
- Minimal operational district readiness.

Kindergarten manager onboarding now asks for:

- City from controlled list.
- Street.
- Address details.
- Internal operational district readiness.

Public directory behavior was not changed.

## District Readiness Status
District labels are operational and neutral:

- North / Haifa / Center / Tel Aviv / Jerusalem / South / Other / Unknown equivalents in Hebrew.
- Unknown is allowed for incomplete mapping.
- No political/legal public claim was added.

## Admin City Analytics Status
Added:

- `/dashboard/admin/kindergarten-analytics`

Admin can see:

- Total kindergartens.
- Active kindergartens.
- Pending approval.
- Approved/pending subscription.
- Demo active readiness.
- Frozen/suspended.
- Rejected.
- Grouping by city and derived operational district.

No database migration was added.

## Manager Subscription / Payment Status
Improved manager-facing subscription panel:

- Shows Gan Batuach subscription.
- Shows base monthly price.
- Shows additional group/class price rule.
- Shows 3-day demo readiness text.
- Shows frozen/suspended risk message.
- Separates parent tuition from Gan Batuach subscription.
- Warns that live charging does not occur if provider is not configured.

No payment provider logic was changed.

## Demo / Freeze Lifecycle Status
UI now explains:

- 3-day demo readiness.
- Payment required after approval.
- Freeze/suspend if payment is not arranged.

Not implemented intentionally:

- No fake cron.
- No automated 3-day suspension job added in this phase.

## User Search / Link Readiness
No broad search/link feature was added in this phase because it touches sensitive access logic.

Requires stronger follow-up:

- Manager search/link existing parent by allowed identifiers.
- Manager search/link registered staff candidate.
- Admin search/link inspector.
- Child transfer/release flow between kindergartens.

## Payment Provider Readiness
Existing manual/provider readiness remains.

No changes were made to:

- Live provider keys.
- Card storage.
- Provider secrets.
- Payment webhooks.
- Parent tuition payment logic.
- Digital Observer billing.

## Items Not Implemented Intentionally
- Google login.
- Apple login.
- Facebook/social login.
- Fake biometric login.
- Automated demo-expiry cron.
- Unsafe auto-linking of users.
- Child transfer takeover.
- RLS changes.
- Payment provider activation.

## Items Requiring External Provider Setup
- Password reset email delivery.
- Live payment provider.
- Invoice provider.
- SMS/WhatsApp provider if phone verification is required.

## Items Requiring Stronger Follow-Up
- Full RLS/access review.
- Role-specific registration persistence for ID/experience/regions beyond core profile.
- Safe user search/link workflows.
- Child transfer flow between kindergartens.
- Demo expiry automation.
- Production payment activation.

## QA Recommendation
Safe to proceed to QA 2 re-run for app/login/register/city/subscription UX.

Then proceed to QA 3 for:

- RLS.
- Auth.
- Payment permissions.
- Sensitive documents.
- Medical data.
- Camera access.
- AI exposure.
