# PHASE 190C-FIX – App Gateway Login/Register UX Continuity Report

תאריך: 2026-06-16

## Summary

בוצע תיקון UX/route continuity בלבד: משתמש שנכנס מהאתר הציבורי דרך “כניסה למערכת” אל `/app` נשאר עכשיו בתוך חוויית אפליקציה אחידה גם בהמשך בדפדפן, התחברות, הרשמה ובחירת תפקיד.

לא בוצעו שינויי RLS, הרשאות, תשלומים, subscription activation, מסמכים רגישים, מצלמות, AI או הצפנה.

## Routes Changed / Added

### Updated

- `/app`
  - “המשך בדפדפן” מוביל ל־`/app/login`
  - “משתמש קיים” מוביל ל־`/app/login`
  - “משתמש חדש” מוביל ל־`/app/register`
- `/login`
  - נשאר קיים.
  - עכשיו משתמש באותה חוויית app-auth כמו `/app/login`.
- `/register`
  - נשאר קיים.
  - עכשיו משתמש באותה חוויית app-auth כמו `/app/register`.
- `signIn`
  - לא שונתה לוגיקת האימות.
  - נוסף שדה UX בלבד כדי ששגיאת כניסה ממסך `/app/login` תחזור ל־`/app/login` ולא למסך ישן.
- `signOut`
  - מפנה עכשיו ל־`/app/login` כדי לשמור רצף אפליקטיבי.

### Added

- `/app/login`
- `/app/register`
- `/app/register/parent`
- `/app/register/kindergarten`
- `/app/register/staff`
- `/app/register/inspector`

## Login UX Status

- מסך `/app/login` ממשיך את העיצוב של `/app`.
- כולל:
  - לוגו וברנדינג גן בטוח
  - כרטיס מרכזי mobile-first
  - שדה אימייל
  - שדה סיסמה
  - קישור שכחתי סיסמה
  - כפתור התחברות
  - קישור הרשמה
  - חזרה ל־`/app`
- לא נוספו Google Login, Apple Login או Face ID מזויף.

## Register UX Status

- `/app/register` מציג רק בחירת סוג משתמש.
- תפקידי הרשמה מוצגים ככרטיסים מודרניים:
  - הורה
  - מנהלת גן / גננת
  - צוות גן
  - מפקח
- אין טופס ענק אחד לכל המשתמשים במסך הבחירה.
- אין טבלת אדמין או layout מפוזר.

## Role-Specific Screens Status

- `/app/register/parent`
  - מציג טופס הורה ממוקד בלבד.
- `/app/register/kindergarten`
  - מציג טופס מנהלת גן / גננת ממוקד בלבד.
- `/app/register/staff`
  - מציג טופס צוות ממוקד בלבד.
- `/app/register/inspector`
  - מציג טופס מפקח ממוקד בלבד.

כל הטפסים משתמשים באותו endpoint קיים:

- `/api/self-service/register`

לא נוצר מודל משתמש חדש ולא שוכפל מנגנון הרשמה.

## Old Route Compatibility

- `/login` עדיין עובד, אבל עטוף באותו app auth shell.
- `/register` עדיין עובד, אבל עטוף באותו app auth shell.
- קישורים קיימים לא נשברים.
- זרימות invitation קיימות לא הוסרו ולא שונו. אם הן מגיעות ל־`/login`, הן מקבלות עכשיו את אותו מסך אפליקטיבי.

## App Gateway Continuity

תוצאה לאחר התיקון:

Public website → “כניסה למערכת” → `/app` → “המשך בדפדפן” → `/app/login`

וגם:

- `/app` → “התחברות” / משתמש קיים → `/app/login`
- `/app` → “הרשמה” / משתמש חדש → `/app/register`
- `/app/register` → בחירת תפקיד → route ממוקד לפי תפקיד

המשתמש לא נזרק יותר למסכי login/register ישנים ומפוזרים.

## Sensitive Logic Status

- Auth mechanism: לא שונה.
- RLS: לא שונה.
- Payments/subscriptions: לא שונו.
- Invitation-based registration: לא נשבר ולא הוסר.
- Sensitive documents/medical/camera/AI: לא נגעתי.

## Remaining Issues

- יש לבצע QA ויזואלי בדפדפן על מובייל ודסקטופ כדי לוודא תחושת app-like מלאה.
- בדיקת invitation token אמיתית דורשת נתוני דמו/קישור הזמנה אמיתי.
- אם רוצים להציג Passkey/WebAuthn במסך החדש, מומלץ לעשות זאת בפאזה ייעודית כדי לא ליצור תחושת “Face ID מזויף”.

## QA Recommendation

אפשר להריץ QA חוזר למסלולים:

- `/app`
- `/app/login`
- `/app/register`
- `/app/register/parent`
- `/app/register/kindergarten`
- `/app/register/staff`
- `/app/register/inspector`
- `/login`
- `/register`

ולאחר מכן להמשיך ל־QA 3 עבור RLS והרשאות עומק.

## Verification

- `npm run typecheck`: עבר
- `npm run build`: עבר
- `git diff --check`: עבר
- בדיקת דפדפן מקומית: לא בוצעה בסביבה הזו כי פתיחת שרת פיתוח נחסמה על ידי sandbox עם `EPERM` גם על `0.0.0.0:3000` וגם על `127.0.0.1:3000`.
