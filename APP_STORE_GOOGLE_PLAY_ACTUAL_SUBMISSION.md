# App Store / Google Play Actual Submission

Status: controlled submission workflow. No publication performed.

## Workflow

Visitor does not see this process. Admin/release owner controls it from:

`/dashboard/admin/mobile-submission`

## iOS Process

1. Verify Apple Developer account.
2. Confirm bundle identifier.
3. Prepare signing certificate and provisioning profile outside the repo.
4. Prepare App Store metadata.
5. Finalize privacy labels.
6. Capture screenshots with synthetic data.
7. Prepare reviewer notes and demo accounts.
8. Build and archive in Xcode.
9. Upload to TestFlight only after approval.
10. Move to App Review only after QA and final approval.

## Android Process

1. Verify Google Play Developer account.
2. Confirm application ID.
3. Prepare Play App Signing / release signing outside the repo.
4. Prepare Play listing metadata.
5. Finalize Google Play Data Safety.
6. Capture screenshots with synthetic data.
7. Prepare reviewer notes and demo accounts.
8. Build signed Android release.
9. Upload to internal testing only after approval.
10. Move to closed/production tracks only after QA and final approval.

## QA Checklist

Required mobile QA:

- login
- password reset
- MFA
- onboarding
- parent profile
- child timeline
- staff workflow
- manager workflow
- inspector workflow
- documents
- payments
- notifications
- deep links
- camera viewing if enabled
- support
- privacy request
- logout

## Rejection Handling

If Apple or Google rejects the app:

1. Log the reason.
2. Assign owner.
3. Document required fix.
4. Update reviewer notes if needed.
5. Retest.
6. Resubmit only after approval.

## Manual Steps Still Required

- real developer account access
- signing assets
- store screenshots
- final legal URLs
- final privacy disclosures
- reviewer account credentials through secure handling
- manual upload and submit

## Guardrails

- do not publish automatically
- do not commit certificates or keys
- do not store reviewer passwords in public files
- do not use real children or private data in screenshots
- do not request microphone permission for Gan Batuach observer monitoring
- do not expose camera credentials or RTSP URLs
