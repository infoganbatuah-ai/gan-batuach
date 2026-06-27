# RELEASE 1 - Demo User Journey Scripts

Date: 2026-06-27

Use synthetic accounts only. Do not include real passwords.

## 1. Founder / Admin Demo

Start route: `/app`

Account placeholders:

- `demo_admin_email`
- `demo_admin_password`

Screens:

- app gateway
- admin dashboard
- kindergarten approvals
- users
- provider health
- subscriptions
- security/readiness

Talk track:

“כאן רואים את מרכז הבקרה של גן בטוח. כל פעולה רגישה נשארת מאחורי הרשאות אדמין, והמצב הנוכחי הוא דמו פנימי עם נתונים סינתטיים.”

Do not claim:

- production approval
- live providers
- real pilot readiness

Expected result:

- stakeholder understands the operational control center.

## 2. Kindergarten Manager Demo

Start route: `/dashboard/garden`

Account placeholders:

- `demo_manager_email`
- `demo_manager_password`

Screens:

- manager dashboard
- children
- enrollment requests
- staff
- documents
- subscription readiness
- camera readiness

Talk track:

“מנהלת הגן רואה רק את הגן שלה, את הילדים/בקשות/צוות המשויכים אליו, ואת מצב המנוי כמוכנות או דמו.”

Do not claim:

- live payment
- active parent camera viewing

## 3. Parent Demo

Start route: `/dashboard/parent`

Account placeholders:

- `demo_parent_email`
- `demo_parent_password`

Screens:

- child card
- enrollment/request status
- schedule
- messages
- payments/readiness
- camera unavailable/readiness state

Talk track:

“הורה רואה רק את הילד והבקשות שלו. אין חשיפה לילדים אחרים או מידע פנימי של הגן.”

Do not claim:

- parent live camera access
- guaranteed safety

## 4. Staff Demo

Start route: `/dashboard/staff`

Account placeholders:

- `demo_staff_email`
- `demo_staff_password`

Screens:

- staff dashboard
- assignment state
- attendance/shifts
- tasks
- documents
- messages

Talk track:

“איש צוות רואה רק את המידע המותר לפי שיוך והרשאות.”

## 5. Inspector Demo

Start route: `/dashboard/inspector`

Account placeholders:

- `demo_inspector_email`
- `demo_inspector_password`

Screens:

- pending/approved inspector state
- assigned gardens
- inspections
- inspection report
- findings/follow-up

Talk track:

“מפקח רואה רק גנים ששויכו אליו, ותהליך הביקורת נשאר מתועד ומובנה.”

## 6. Digital Observer Demo

Start route: `/digital-observer` or `/digital-observer/dashboard`

Account placeholders:

- `demo_observer_email`
- `demo_observer_password`

Screens:

- Digital Observer product page
- dashboard readiness
- sites/cameras readiness
- review/shadow state

Talk track:

“התצפיתן הדיגיטלי מוצג כאן כמוכנות/Shadow בלבד. אין טענת AI חיה ואין חשיפה להורים.”

## 7. Investor High-Level Demo

Start route: `/`

Screens:

- public homepage
- role explanation
- app gateway
- admin overview
- one manager/parent journey
- provider/camera/AI readiness page

Talk track:

“המערכת מחברת ניהול גן, תקשורת עם הורים, צוות, פיקוח ובקרה תפעולית למוצר אחד. זה דמו פנימי עם נתונים סינתטיים; לפני פיילוט אמיתי נשארים שערי אבטחה, פרטיות וספקים.”

Do not claim:

- regulatory approval
- prevention guarantee
- production pilot readiness
