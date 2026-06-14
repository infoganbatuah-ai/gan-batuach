# App Store And Google Play Submission Readiness

Status: readiness only. Do not submit, upload, publish, sign production builds, or activate production mobile release without explicit approval.

## Mobile Architecture

Gan Batuach mobile architecture:

- Next.js / React / TypeScript web app.
- Capacitor mobile wrapper.
- iOS native shell under `ios/App`.
- Android native shell under `android/app`.
- Native features through Capacitor plugins.

This is not React Native and not Flutter.

Current Capacitor configuration:

- `appId`: `com.ganbatuach.app`
- `appName`: `גן בטוח`
- `webDir`: `public`
- `server.url`: from `CAPACITOR_SERVER_URL` or `NEXT_PUBLIC_APP_URL`
- configured plugins: SplashScreen, Haptics, StatusBar

## iOS Checklist

- Bundle identifier: `com.ganbatuach.app`
- App display name: `גן בטוח`
- App icon: native asset exists, final review required.
- Launch screen: storyboard exists, final review required.
- App version: readiness value `1.0.0`
- Build number: readiness value `1`
- iPad support: orientations exist, final support decision required.
- Minimum iOS version: confirm in Xcode before submission.
- Apple Developer account: verify before TestFlight upload.
- Signing profile: not prepared in this phase.
- App Store Privacy Labels: draft only, legal review required.

## Android Checklist

- Application ID: `com.ganbatuach.app`
- App display name: `גן בטוח`
- App icon: native assets exist, final review required.
- Splash screen: native assets exist, final review required.
- Version code: readiness value `1`
- Version name: readiness value `1.0`
- Minimum Android version: from Gradle variables.
- Target SDK: from Gradle variables, confirm before Play submission.
- Google Play Developer account: verify before upload.
- Signing keystore: not prepared in this phase.
- Google Play Data Safety: draft only, legal review required.

## Native Permissions Inventory

Location:

- Purpose: GPS attendance, child pickup validation and inspector field validation.
- Use only for feature-specific workflows.
- Do not imply continuous tracking.

Notifications:

- Purpose: child updates, messages, documents, payments, inspections, approved safety updates and system notifications.
- Must respect notification preferences.

Camera / Photos:

- Purpose: upload documents, profile photos and authorized evidence.
- Not for automatic face recognition.

Microphone:

- Should not be requested for Gan Batuach kindergarten observer.
- Audio recording and audio monitoring are disabled for Gan Batuach Israel mode.

Biometric Unlock:

- Future readiness only.
- Do not store biometric templates in application tables.

Background Location:

- Should not be requested for normal Gan Batuach workflows.
- Requires future legal review if ever needed.

## Permission Explanation Copy

Location:

`המיקום משמש לאימות הגעה ואיסוף מהגן ולפיקוח בשטח, בהתאם להרשאות ולמדיניות הפרטיות.`

Notifications:

`התראות משמשות לעדכוני גן, הודעות, מסמכים, תשלומים ועדכוני בטיחות שאושרו.`

Camera / Photos:

`הגישה לתמונות משמשת להעלאת מסמכים, תמונות פרופיל ותיעוד מורשה בלבד.`

Microphone:

`המיקרופון אינו נדרש לתצפיתן הגן ואינו משמש לניטור שמע בגני ילדים.`

## Push Readiness

Push readiness includes:

- FCM readiness for Android.
- APNs readiness for iOS.
- Web Push readiness.
- Device token registration.
- Token revocation.
- Duplicate cleanup readiness.
- Deep links.
- Notification preferences.
- Category mapping.

Notification categories:

- Child updates.
- Messages.
- Documents.
- Payments.
- Inspections.
- Safety updates.
- System notifications.

Production push requires provider credentials and explicit production-send approval.

## Deep Link Readiness

Prepared deep link targets:

- Child timeline.
- Parent messages.
- Document approval / documents.
- Payment screen.
- Pickup contact.
- Inspection report / inspection list.
- Task.
- Notification detail readiness.
- Camera screen if allowed.

Every deep link must enforce authentication and role permissions after opening.

## Mobile Security Readiness

Required controls:

- MFA support.
- Trusted device readiness.
- Secure session handling.
- Logout.
- Token refresh.
- Account lockout handling.
- Re-authentication for sensitive actions.

Sensitive actions include camera viewing, medical data access, document downloads, payments, role changes and account deletion requests.

## Camera Viewing Protection

Android:

- `FLAG_SECURE` readiness for camera viewing screens.

iOS:

- `UIScreen.isCaptured` detection readiness.
- Mask video player when capture is detected.

Web:

- Watermark and audit only.
- Do not claim full screenshot prevention on web.

Dynamic watermark readiness:

- Viewer legal name.
- Masked phone.
- Timestamp.
- Session ID.
- Optional masked IP/device indicator.
- Position should move or change over time.

## App Store Privacy Labels

Data categories prepared:

- Contact info.
- Identifiers.
- User content.
- Health/medical information.
- Location.
- Diagnostics.
- Payment information.
- Photos/documents.
- Camera viewing metadata.

Each category must be reviewed for:

- Whether collected.
- Purpose.
- Whether linked to user.
- Whether shared with third parties.

Do not submit labels before legal/privacy review.

## Google Play Data Safety

Prepared mapping includes:

- Data collected.
- Purpose.
- Sharing.
- Encryption in transit.
- Deletion request support.
- Account deletion support.

Do not submit Data Safety answers before legal/privacy review.

## Child Safety And Sensitive Data Review

Review areas:

- Child data.
- Parent data.
- Staff data.
- Medical information.
- Camera viewing.
- Location usage.
- Notifications.
- Documents.

Store copy must not imply unrestricted monitoring, automatic AI decisions, unrestricted parent camera access or full prevention of safety incidents.

## Store Metadata

Hebrew readiness:

- App name: `גן בטוח`
- Subtitle: draft for legal review.
- Short description: draft for legal review.
- Full description: draft for legal review.
- Keywords: draft.
- Support URL: missing final public URL.
- Privacy Policy URL: draft / final URL required.
- Terms URL: draft / final URL required.

English readiness:

- App name: `Gan Batuach`
- Subtitle: draft.
- Short description: draft.
- Full description: not final.
- Keywords: not final.

## Screenshot Plan

Screens to capture:

- Parent child timeline.
- Parent notifications.
- Parent documents.
- Manager command center.
- Staff daily workflow.
- Inspector inspection flow.
- Safety/trust view.
- Login/onboarding.

Rules:

- Demo/synthetic data only.
- No real children.
- No real private data.
- No medical documents.
- No ID documents.
- No screenshots of raw AI events.

## App Icon And Branding Readiness

Checklist:

- App icon.
- Adaptive Android icon.
- iOS icon sizes.
- Splash screen.
- Launch screen.
- Brand colors.
- Store graphics.

Native assets exist, but final store preview and brand review remain required.

## Build Pipeline

Prepare:

- iOS local build with Xcode.
- Android local build with Android Studio/Gradle.
- CI build readiness.
- Staging build.
- Production build.
- Signing requirements.
- Environment variables.

Rules:

- Do not sign production builds in this phase.
- Do not upload to App Store Connect or Google Play Console.
- Provider secrets remain server-side.
- Mobile build should use public app URL only.

## Release Channels

Google Play:

- Internal testing readiness.
- Closed testing readiness.
- Production readiness.

Apple:

- TestFlight internal readiness.
- TestFlight external readiness.
- App Review readiness.
- Production readiness.

Recommended stages:

1. Internal testing.
2. Closed beta / TestFlight external.
3. Pilot release.
4. Production release after approval.

## Store Review Notes

Reviewer notes should include:

- Demo login accounts.
- Role explanations.
- Why permissions are requested.
- Camera behavior explanation.
- No audio monitoring in Gan Batuach Israel mode.
- No face recognition in Gan Batuach Israel mode.
- Child safety/privacy explanation.
- Known limitations.

## Demo Account Pack

Prepare synthetic accounts:

- Parent.
- Manager.
- Staff.
- Inspector.
- Limited admin reviewer account if needed.

No real personal data may be used.

## Account Deletion Readiness

Users should be able to request deletion/anonymization through `/dashboard/privacy`.

Deletion remains admin-reviewed where legal holds, payment records, audit logs, inspection evidence or safety investigations apply.

## Privacy And Terms Links

Required links:

- Privacy Policy.
- Terms of Use.
- Camera Privacy Notice.
- AI Processing Notice.
- Data Subject Rights Notice.
- Support Contact.

Draft/legal-review-ready links are acceptable for internal readiness, but final public URLs are required before submission.

## Mobile QA Checklist

Test before store testing:

- Login.
- MFA.
- Onboarding.
- Parent timeline.
- Staff workflow.
- Manager command center.
- Inspector forms.
- Push notifications.
- Deep links.
- Payments.
- Documents.
- Camera viewing if enabled.
- Logout.
- Account deletion request.

## Crash And Diagnostics Readiness

Future options:

- Sentry.
- Firebase Crashlytics.
- Other provider.

No real crash provider is required or activated in this phase.

## Remaining Manual Setup

- Apple Developer account verification.
- Google Play Developer account verification.
- iOS signing and provisioning profile.
- Android signing keystore.
- Store screenshots with synthetic data.
- Final privacy policy and terms URLs.
- Final privacy labels and Data Safety review.
- TestFlight upload.
- Google internal testing upload.
- Store reviewer demo accounts.
- Native camera-viewing protections QA.
- Push provider production configuration.
