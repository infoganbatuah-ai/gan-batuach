# UX/UI RESCUE 3 - Product Reality Rules

Date: 2026-08-06

These rules are now the UX contract for pilot-prep screens.

1. If a feature works, the button must work.
2. If a feature is not ready, it must show a clear disabled/readiness state.
3. If a feature is blocked by policy, legal review, RLS, provider setup or pilot mode, explain that briefly.
4. Never show fake live camera.
5. Never show fake live AI.
6. Never show fake successful payment.
7. Never show fake WhatsApp/SMS sent.
8. Never show empty dead dashboards.
9. Never show raw enum values to normal users where a Hebrew label should be shown.
10. Every main card must have a real destination, a real action or a truthful unavailable state.

## Hebrew Readiness States

Use these labels where appropriate:

- עדיין לא פעיל בפיילוט
- מוכן להגדרה
- דורש אישור אדמין
- דורש חיבור ספק
- דורש אישור משפטי/מדיניות
- פעיל בסביבת דמו בלבד
- לא זמין כרגע
- השלב הבא: הגדרה דרך אדמין

## Locked Features

Until future explicit approval:

- Live payments: locked.
- Parent camera viewing: locked.
- Live AI or raw AI to parents: locked.
- Production SMS/WhatsApp: locked.
- Real child documents: locked until RLS/legal/environment gates pass.

