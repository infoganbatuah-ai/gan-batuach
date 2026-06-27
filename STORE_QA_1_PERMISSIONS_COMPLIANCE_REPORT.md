# STORE QA 1 - Permissions Compliance Report

Date: 2026-06-27

## Native Permission State

Android:

- `android.permission.INTERNET`

iOS:

- no camera usage description
- no microphone usage description
- no photo library usage description
- no location usage description
- no Face ID/biometric usage description

## QA Result

permissions_result = acceptable_minimal

Current native permissions are minimal and match the app's current store-readiness status.

## Compliance Notes

- Camera permission is not requested; do not show store claims requiring native camera capture until real-device upload/capture behavior is validated.
- Photo library permission is not requested; add only if WebView uploads require native usage text.
- Location permission is not requested; add only if staff/inspector GPS needs native permission on device.
- Microphone is not requested; this is correct for Gan Batuach Israel Mode.
- Face ID/biometrics are not requested; this is correct because no fake biometric login should be claimed.
- Push native permission still requires FCM/APNs/device-token validation before store claims.

Status:

- blocking = false for internal testing
- real_device_required = true before submission
