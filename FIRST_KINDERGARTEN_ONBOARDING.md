# First Kindergarten Onboarding

Use this checklist to onboard the first real kindergarten into Gan Batuach.

## 1. Pre-Onboarding Call

- Confirm kindergarten legal/business name.
- Confirm manager/owner name, phone and email.
- Confirm whether manager and owner are the same person.
- Confirm address and city.
- Confirm number of children and staff.
- Confirm age groups/classes.
- Confirm monthly pricing by age group.
- Confirm camera policy and whether parent viewing is part of the pilot.
- Confirm document requirements for parents/staff.
- Confirm pilot start date.

## 2. Create Kindergarten

Admin flow:

- Open `/dashboard/admin/users/new-kindergarten` or the approved admin kindergarten creation flow.
- Create kindergarten.
- Upload kindergarten logo/image.
- Add address and contact details.
- Set public profile visibility.
- Assign manager/owner.
- Assign inspector if part of pilot.

Verify:

- Kindergarten appears in `/dashboard/admin/gardens`.
- Public page appears in `/gardens` if public profile is enabled.
- Manager can log in and opens `/dashboard/garden`.

## 3. Configure Age Groups And Pricing

Manager/admin flow:

- Open kindergarten settings.
- Create age groups/classes.
- Add age range where relevant.
- Add monthly price per group.
- Add capacity per group.
- Decide whether prices are public.

Verify:

- Parent registration age group options match kindergarten settings.
- Public kindergarten card shows accepted age groups.
- Finance page shows fee groups.

## 4. Create Manager / Owner

- Create manager account.
- Create owner account if separate.
- Upload profile photo.
- Verify identity number if required.
- Generate or set temporary credentials.
- Verify credentials are visible only to authorized admin/manager flows.

Verify:

- Manager login works.
- Dashboard identity shows manager name and kindergarten name/logo.

## 5. Create Staff

Manager flow:

- Open `/dashboard/garden/staff`.
- Add staff member.
- Add staff ID number, phone, role and email if available.
- Upload staff profile photo.
- Generate temporary credentials.
- Assign staff to the kindergarten/class if supported.

Verify:

- Staff can log in.
- Staff dashboard shows kindergarten and role.
- Staff can complete profile/settings.

## 6. Invite Parents

Options:

- Parent registers from public kindergarten page.
- Manager creates/invites parent from dashboard if supported.

For each parent:

- Collect parent full name.
- Collect phone.
- Collect parent ID where required.
- Collect child full name and child ID.
- Select requested age group.
- Add requested start date.

Verify:

- Lead appears in `/dashboard/garden/leads`.
- Manager approves lead.
- Temporary credentials are generated.
- Parent account becomes active.
- Child remains pending parent completion.

## 7. Approve Children

Parent flow:

- Parent logs in.
- Parent completes child profile.
- Parent uploads child photo.
- Parent uploads at least one parent photo.
- Parent adds pickup persons.
- Parent accepts policies/declarations.

Manager flow:

- Open `/dashboard/garden/children?status=pending`.
- Review child photo, parent photo, pickup persons, allergies, notes and approvals.
- Approve, reject or request correction.

Verify:

- Approved child appears in active children list.
- Parent dashboard shows active child.

## 8. Configure Cameras

Only if cameras are included in pilot.

Manager/admin flow:

- Open `/dashboard/garden/cameras`.
- Add camera.
- Set name, area/class and source type.
- Do not expose RTSP credentials to users.
- Enable parent viewing only for approved cameras.
- Use sample HLS only for testing.

Verify:

- Manager sees camera.
- Parent sees only allowed cameras.
- Camera without playback source shows waiting state.

## 9. Configure Documents

- Define required parent documents if any.
- Define required staff documents if any.
- Verify upload flow.
- Verify manager review/approval flow.

## 10. Configure Subscription / Billing

If subscription management is manual for pilot:

- Record monthly pilot price.
- Record billing contact.
- Record invoice/payment process outside the app if payment gateway is not implemented.

If child payments are tracked in app:

- Configure fee groups.
- Mark first child payment statuses.
- Verify failed/not transferred status works.

## 11. Pilot Day-One Checklist

- Admin can log in.
- Manager can log in.
- Staff can log in.
- At least one parent can log in.
- At least one child is active.
- At least one parent request can be sent and handled.
- Staff can update child meal/sleep/mood.
- Manager finance page loads.
- Notifications appear.
- Health route works.
- Support contact is ready.

## 12. Handoff To Kindergarten

Give the manager:

- Login URL.
- Manager username.
- Temporary password or reset flow.
- Parent invitation instructions.
- Staff invitation instructions.
- Support contact.
- Pilot feedback channel.

Do not send real passwords over public channels without the customer's approval.
