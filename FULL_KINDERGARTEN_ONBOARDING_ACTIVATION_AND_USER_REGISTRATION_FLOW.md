# Full Kindergarten Onboarding, Activation & User Registration Flow

## Goal

A kindergarten becomes active only after the full activation path is completed:

- Public registration submitted
- Admin approval completed
- Manager first login completed
- Staff initialized
- Children initialized
- Parents invited
- Required documents uploaded
- Gan Batuach subscription payment completed
- Subscription activated

## Public Registration

Managers register through `/join-kindergarten`.

Required fields:

- Manager full name
- Manager phone
- Manager email
- Kindergarten name
- City
- Street
- Building number
- Fixed age groups
- Terms and service charter acceptance

City and street are selected from a controlled Israeli list in the UI. The initial list is intentionally small and should be expanded or connected to a national address provider before broad production rollout.

## Fixed Age Groups

Supported age groups:

- `INFANT`: 3-15 months, max 15 children, 1 staff per 6 infants
- `TODDLER_YOUNG`: 16-24 months, max 22 children, 1 staff per 9 toddlers
- `TODDLER_MATURE`: 25-36 months, max 27 children, 1 staff per 11 children
- `KINDERGARTEN`: 3+ years, max 35 children, 2 staff for a full class

The activation wizard validates:

- Maximum children per class
- Required staff count
- Missing staff count
- Ratio alerts

## Terms & Regulatory Acceptance

The manager must approve:

- Platform terms
- Privacy terms
- Camera rules
- Child safety terms
- Regulatory declaration
- Gan Batuach service charter

Acceptances are stored in `kindergarten_legal_acceptances` with version and timestamp.

## Service Charter

Public page:

- `/service-charter`

Admin editor:

- `/dashboard/admin/service-charter`

The charter covers:

- Manager responsibility
- Child safety
- Staff compliance
- Documents
- Inspections
- Cameras without audio
- Cooperation with Gan Batuach
- Regulatory responsibility
- Parent transparency

## Admin Approval Flow

Admin reviews leads in:

- `/dashboard/admin/leads`
- `/dashboard/admin/kindergarten-activation`

Admin can:

- Approve
- Request contact
- Mark contacted
- Mark not relevant
- Archive
- Convert lead to pending kindergarten registration

Approval creates:

- Pending kindergarten
- Manager account
- One-time credentials
- Onboarding record
- Credential delivery logs for email, WhatsApp and SMS readiness

## First Login Flow

Manager is redirected to:

- `/onboarding/kindergarten`

The normal dashboard remains locked while the kindergarten is not active.

Password-change enforcement uses the existing generated credential model. Full native password-change enforcement should be smoke-tested with Supabase Auth before pilot.

## Guided Activation Wizard

Wizard steps:

1. Financial setup
2. Age group pricing
3. Class capacity setup
4. Staff setup
5. Children setup
6. Parent invitations
7. Vacation calendar
8. Weekly schedule
9. Manager profile
10. Documents
11. Payment
12. Activation confirmation

Status model:

- `registration_pending`
- `admin_approved`
- `activation_in_progress`
- `payment_pending`
- `active`
- `suspended`

## Staff Invitation Flow

The current platform already supports staff creation and generated credentials.

Required production completion:

- WhatsApp/SMS delivery wiring
- Staff profile completion enforcement
- ID document upload
- Sexual offense clearance upload
- Police clearance upload
- Manager notification when staff completes profile

## Parent Invitation Flow

The current platform already supports parent creation, credentials and parent onboarding.

Required production completion:

- Parent invitation message with child name
- Father/mother/guardian completion workflow
- Child card automatic completion from parent profile
- Manager notification after parent completion

## Documents

Required categories:

- Ownership and legal entity
- Legal management authorization
- First aid certificate, minimum 22 hours
- Safe conduct course certificate
- Educational mentor agreement
- Building and yard safety report
- Minimum space confirmation
- Local authority operating permit
- Fire department approval
- Shelter approval
- CCTV installation declaration
- No audio declaration
- Camera coverage declaration

Admin can review documents through the existing document center.

## Payment Activation

Gan Batuach subscription:

- Base: 800 NIS per month for one age group/class
- Additional age group/class: 200 NIS per month
- Annual subscription paid monthly

Supported payment methods are readiness-only until real providers are activated:

- Credit card
- Apple Pay
- Google Pay

Before payment, status remains:

- `activation_in_progress`
- `payment_pending`

After payment:

- Subscription active
- Invoice generated
- Admin notified
- Kindergarten becomes active
- Manager gains full access

## Failed Payment Rules

If an active kindergarten payment fails:

- Notify manager in system
- WhatsApp/SMS readiness
- Show red warning
- Start one-month grace period
- Unpaid month becomes debt
- If fixed during grace period, charge debt and continue
- If not fixed, freeze kindergarten

## Permission Enforcement

If kindergarten is not active, allow only:

- Profile completion
- Children add
- Parent invite
- Staff invite
- Document upload
- Payment

Block:

- Full dashboard
- Cameras
- Inspections
- Parent live features
- AI observer
- Advanced reports

## Remaining Gaps

- Connect full Israeli city/street provider.
- Implement real payment checkout provider.
- Enforce Supabase first-login password change in UI.
- Complete native staff profile upload flow.
- Complete native parent completion flow for both parents.
- Add automatic activation after verified payment callback.
- Add full failed-payment grace job.
