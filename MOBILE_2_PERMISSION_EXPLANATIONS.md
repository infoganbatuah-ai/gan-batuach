# MOBILE 2 - Permission Explanations

Date: 2026-06-27

## Current Native Permissions

Android:

- Internet only.

iOS:

- No camera, microphone, location, photo, Face ID, or push permission usage strings currently configured.

## Prepared Explanations

Camera:

- Hebrew: `גישה למצלמה תשמש רק לצילום או העלאת מסמכים/ראיות כאשר המשתמש בוחר בכך.`
- English: `Camera access is used only for capturing or uploading documents/evidence when the user chooses to do so.`

Photo Library:

- Hebrew: `גישה לתמונות תשמש רק לבחירת קבצים או תמונות שהמשתמש בוחר להעלות.`
- English: `Photo library access is used only to select files or images the user chooses to upload.`

Location:

- Hebrew: `גישה למיקום תשמש רק לאימות נוכחות או ביקורת כאשר תכונה זו מופעלת ובהתאם להרשאות.`
- English: `Location access is used only for attendance or inspection verification when enabled and authorized.`

Notifications:

- Hebrew: `התראות ישמשו לעדכונים חשובים הקשורים לגן, בקשות, משימות, תשלומים או ביקורות בהתאם להרשאות.`
- English: `Notifications are used for important updates related to the kindergarten, requests, tasks, payments, or inspections according to permissions.`

Microphone:

- Do not request for Gan Batuach Israel Mode unless explicitly approved and implemented.

Face ID / Biometrics:

- Do not request unless real biometric/passkey login is implemented and legally approved.

## Status

permission_status = minimal_now

Before submission:

- Add only permissions actually required by real-device testing.
- Keep microphone and biometric permissions disabled unless a real approved feature exists.
