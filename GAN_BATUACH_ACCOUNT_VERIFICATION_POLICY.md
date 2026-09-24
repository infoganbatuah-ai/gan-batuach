# Gan Batuach account verification policy — GB-M31

## Email verification

For a new self-service Management account, a confirmed Supabase Auth email is sufficient for normal account verification. The existing `contact_verification_required` flag still distinguishes enrolled new accounts from legacy accounts; it no longer means that both channels are required. The server-side evaluator is `evaluateAccountVerification` in `lib/management/contact-verification.ts`. The forward migration `20260920110000_management_email_first_verification.sql` applies the same email-first rule to Garden onboarding, enrollment activation, Staff employment activation and Inspector application/approval RPCs. No historical migration or existing verification timestamp is rewritten.

Supabase Auth remains the identity authority. Email-link/OTP confirmation and resend use its existing flow. A successfully queued resend is not proof that the email was delivered or opened. Password recovery remains single-use and non-enumerating according to the existing Auth flow.

## Phone verification

A typed phone number remains unverified. A `phone_confirmed_at` Auth result mirrored to `profiles.phone_verified_at` establishes verified phone ownership. `verified_phone_action` in the central evaluator requires that evidence. Phone change continues to use Supabase `phone_change` OTP; its API reports acceptance by Auth, not confirmed delivery. If no SMS/WhatsApp provider is configured, the normal email-verified account remains usable. No new WhatsApp OTP is claimed without a real configured provider.

## Higher assurance

The evaluator returns `mfa_or_reauthentication_required` for `high_assurance_action`; it does **not** allow a verified phone alone to stand in for MFA. Existing camera, Admin, financial and account recovery authorization checks remain separate. No new high-assurance permission is granted in GB-M31. Before activating a high-assurance action, its route must supply and verify the established MFA or reauthentication evidence. Supabase TOTP/MFA availability and enrollment were not proven in this task.

## Action inventory

| Action | Account verification | Additional boundary |
|---|---|---|
| Normal Parent, Staff Candidate, Owner and Inspector Candidate registration/login | Confirmed email for newly enrolled accounts | Domain-specific approval/relationship still required |
| Parent enrollment and Garden onboarding | Confirmed email | Guardian/Garden authority and activation checks remain |
| Staff employment and Inspector approval | Confirmed email | Garden/Admin decision and transactional activation remain |
| Explicit phone-ownership action | Confirmed phone | Action-specific authorization remains |
| Camera, financial/Admin and sensitive recovery actions | Existing stronger route policy | MFA/reauthentication review remains a separate gate; phone is not a substitute |

Legacy accounts with `contact_verification_required=false` keep their previous compatibility status. This is not a general authorization bypass: tenant, employment, Inspector assignment, guardian and Admin guards still run. The prior GB-M04 statement requiring email **and** phone is superseded only for normal Management account verification; preserved historical reports are not edited.
