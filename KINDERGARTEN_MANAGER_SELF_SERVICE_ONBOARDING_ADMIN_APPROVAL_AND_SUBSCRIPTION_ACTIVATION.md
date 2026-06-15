# Kindergarten Manager Self-Service Onboarding, Admin Approval & Subscription Activation

## What Already Existed

- Public kindergarten interest page at `/join-kindergarten`.
- Admin lead conversion flow that creates a pending garden and manager credentials.
- Kindergarten onboarding wizard at `/onboarding/kindergarten`.
- Age-group definitions for `INFANT`, `TODDLER_YOUNG`, `TODDLER_MATURE`, and `KINDERGARTEN`.
- Gan Batuach subscription pricing helper: 800 NIS/month base plus 200 NIS/month per additional class/group.
- Admin activation view at `/dashboard/admin/kindergarten-activation`.
- Garden subscription readiness page at `/dashboard/garden/subscription`.
- Parent discovery flow that only exposes active/public-safe kindergarten data.

## Added / Fixed In This Phase

- Self-registered kindergarten managers now route to `/onboarding/kindergarten` instead of the full garden dashboard.
- Managers without a garden can create a limited kindergarten draft from the onboarding page.
- A self-service kindergarten draft is created as:
  - `gardens.status = pending`
  - `approval_flow_status = activation_in_progress`
  - `public_profile_enabled = false`
  - manager profile remains `active = false`
- The onboarding wizard saves parent tuition price visibility into `kindergarten_fee_groups`.
- Manager-provided parent prices are treated as kindergarten tuition, not Gan Batuach subscription revenue.
- Submitting the wizard moves the garden to `onboarding_submitted`, not active.
- Admin final approval now moves the garden to `payment_pending`, not active.
- A separate admin action activates the kindergarten only after payment success or explicit admin override.
- Activation after payment sets the manager profile to `active = true`.
- Added `/dashboard/admin/kindergarten-applications` for reviewing manager applications, public parent prices, documents, subscription status and activation actions.

## Manager Registration Flow

1. Manager registers independently from `/register` as `Kindergarten Manager`.
2. Account is created with limited state and no active garden access.
3. Manager logs in and lands on `/onboarding/kindergarten`.
4. Manager creates a kindergarten draft.
5. Manager completes the existing onboarding wizard:
   - kindergarten details
   - business/entity information
   - operating hours
   - age groups/classes
   - parent tuition prices
   - public price visibility
   - document readiness notes
   - camera readiness
6. Manager submits for admin review.

## Admin Approval Flow

Admin reviews applications at `/dashboard/admin/kindergarten-applications`.

Admin may:

- request more information
- approve for subscription payment
- reject/archive
- suspend
- activate after verified payment or explicit admin override

Approval for subscription does not activate the kindergarten. It only moves the garden to `payment_pending`.

## Subscription Payment Flow

Revenue streams remain separated:

- Gan Batuach subscription: Kindergarten pays Gan Batuach.
- Parent tuition: Parent pays kindergarten/provider account.
- Digital Observer subscription: Digital Observer customer pays Digital Observer product stream.

After admin approval:

1. Manager sees the subscription activation panel.
2. The system prepares a pending Gan Batuach subscription.
3. Payment provider mode may be manual, sandbox or future live provider.
4. Full activation happens only after payment success or admin override.

## Parent Price Visibility

Age-group prices are saved to `kindergarten_fee_groups`.

Parents can see prices only when:

- the kindergarten is active
- `public_profile_enabled = true`
- the relevant fee group is active
- `show_price_public = true`

These prices are labeled as kindergarten tuition / parent payment and are not Gan Batuach subscription fees.

## Access Rules

Pending manager:

- can view own profile
- can create/edit own kindergarten draft through server-side checked APIs
- can complete onboarding wizard
- cannot access active operational dashboard data
- remains `active = false`

Payment-pending manager:

- can view approval/payment status
- can request subscription payment handling
- cannot access full operational modules

Active manager:

- gets full dashboard access only after payment success or documented admin override.

Parents:

- cannot discover or join inactive, rejected or suspended kindergartens.
- cannot see private kindergarten documents, children, staff, cameras or internal reports.

## RLS / Access Assumptions

- Existing RLS continues to depend on `public.can_access_garden`, which requires `profiles.active = true`.
- This phase did not weaken RLS.
- Self-service manager draft operations use server-side service role with explicit ownership checks.
- Sensitive document upload/review remains in the existing document module and should receive a separate security review before production.

## QA Checklist

- Manager registers independently.
- Manager creates kindergarten draft.
- Manager defines age groups/classes.
- Manager sets parent prices and public visibility.
- Manager submits application.
- Admin sees application in `/dashboard/admin/kindergarten-applications`.
- Admin requests more information.
- Admin approves for subscription.
- Manager sees subscription activation panel.
- Pending manager cannot access full garden dashboard.
- Admin activates after payment/override.
- Manager dashboard unlocks.
- Active kindergarten becomes discoverable to parents only when public-safe settings are enabled.
- Parent cannot submit enrollment to inactive kindergarten.
- Parent tuition and Gan Batuach subscription remain separated.
- Existing invitation-based manager, parent and staff flows still work.

## Remaining Gaps / Manual Review

- Live payment provider activation remains manual and must follow provider production controls.
- Sensitive document upload categories still depend on the existing document module and should be reviewed by security/legal.
- Admin override should be used only with a documented reason.
- Production QA should test direct URL attempts against pending/rejected manager accounts.
- RLS policies should be reviewed in Supabase after applying migrations, especially for active=false self-service managers.
