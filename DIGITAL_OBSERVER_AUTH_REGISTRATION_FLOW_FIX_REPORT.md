# תיקון הרשמה, אימות וכניסה - התצפיתן הדיגיטלי

תאריך: 2026-08-20  
סטטוס קוד: הושלם  
סטטוס סביבת Supabase: נדרשת החלת מיגרציה והגדרת שליחת מייל

## מה תוקן

- הרשמת התצפיתן משתמשת ב-Supabase Auth רגיל ואינה עוקפת אימות מייל בדמו.
- נוספה תמיכה בקוד אימות חד-פעמי ובקישור `token_hash` מאובטח.
- אימות מוצלח מנתק את סשן האימות ומעביר למסך הכניסה של התצפיתן.
- כשל בקוד, בקישור או בהכנת החשבון מוצג במפורש ואינו מדווח כהצלחה.
- כניסה דרך מסך התצפיתן בודקת זהות מוצר עצמאית ואינה שולחת למסלול גננת.
- מסך `/dashboard` מזהה חשבון תצפיתן ומחזיר אותו לדשבורד התצפיתן.
- מסכי ונתיבי API של התצפיתן משתמשים בשומר גישה ייעודי למוצר.
- מסע ההקמה הופרד ממעטפת דשבורד גן בטוח: בית/עסק, מצלמות, מטרות ניטור וחבילה.
- בחירת חבילה יוצרת תקופת ניסיון של עד 14 יום ללא חיוב אמיתי.
- לאחר פקיעת הניסיון, בדיקת חיבור נשארת זמינה אך ניטור חי, AI והתראות חיצוניות נשארים מושהים.
- נוסף כלי מחיקה שמקבל רק מייל מדויק, מסרב ל-production ואינו מדפיס סודות.

## קבצים מרכזיים

- `app/digital-observer/auth-actions.ts`
- `app/digital-observer/verify/page.tsx`
- `app/auth/confirm/route.ts`
- `app/auth/callback/route.ts`
- `app/login/actions.ts`
- `app/dashboard/page.tsx`
- `app/digital-observer/onboarding/page.tsx`
- `app/api/digital-observer/onboarding/route.ts`
- `lib/domain/digital-observer/access.ts`
- `lib/domain/digital-observer/runtime.ts`
- `supabase/migrations/20260820020000_digital_observer_auth_trial_separation.sql`
- `scripts/qa/delete-digital-observer-test-user.mjs`
- `DIGITAL_OBSERVER_SUPABASE_EMAIL_AUTH_SETUP_HE.md`

## בדיקות שבוצעו

- `npm run typecheck`: PASS
- `npm run build`: PASS
- בדיקת רישום ב-1440x900: PASS, ללא גלילה אופקית או לחצן חתוך.
- בדיקת רישום ב-390x844: PASS, ללא גלילה אופקית או לחצן חתוך.
- בדיקת מסך קוד ב-390x844: PASS.
- קישור אימות חסר/פגום: PASS, חוזר למסך קוד עם שגיאה ברורה.
- callback של Supabase ללא קוד: PASS, חוזר לכניסת התצפיתן עם שגיאה.
- מסך הקמה ללא סשן: PASS, חוזר לכניסת התצפיתן ולא למסלול גננת.
- כניסת משתמש ביתי סינתטי קיים: PASS, היעד היה `/digital-observer/dashboard` ולא `/dashboard/garden`.
- מעבר ידני בין ארבעת שלבי ההקמה: PASS. בחירת חבילה הפעילה את לחצן תחילת הניסיון; השמירה לא בוצעה במהלך QA.
- QA מול Supabase: 19/35. כניסת בית/עסק ובידוד בין האתרים עברו; יתר הכשלים מוסברים להלן.

## חסם סביבת Supabase שנותר

בדיקת Supabase החזירה `PGRST205` עבור `digital_observer_accounts`. המשמעות היא שהמיגרציה החדשה עדיין אינה קיימת בפרויקט המרוחק. יש להריץ ב-Supabase SQL Editor את כל תוכן הקובץ:

`supabase/migrations/20260820020000_digital_observer_auth_trial_separation.sql`

המיגרציה:

- יוצרת זהות מוצר עצמאית שאינה משנה תפקיד בגן בטוח.
- מעבירה בבטחה חשבונות ישנים שבבעלותם אתר תצפיתן ביתי/עסקי.
- יוצרת ניסיון של 14 יום ללא חיוב אמיתי.
- אינה נוגעת באתרי גן מסוג `kindergarten`.
- אינה מחלישה RLS.

## מייל אימות

הקוד מוכן, אך שליחה אמיתית תלויה בהגדרת Supabase Auth ו-SMTP/Resend. יש לבצע פעם אחת את ההוראות בקובץ:

`DIGITAL_OBSERVER_SUPABASE_EMAIL_AUTH_SETUP_HE.md`

עד שהמיגרציה, תבנית `Confirm signup` וספק המייל לא מוגדרים, אין לסמן שליחת מייל ואימות end-to-end כ-PASS.

## מחיקת משתמשי הבדיקה

לא נמחק משתמש משום שלא נמסרו כתובות המייל המדויקות. מחיקה רחבה או לפי ניחוש אינה בטוחה. לאחר קבלת כל מייל מדויק ניתן למחוק דרך Supabase Dashboard, או בעזרת:

```bash
npm run qa:delete-digital-observer-test-user -- --email=<exact-email> --confirm=DELETE:<exact-email> --environment=demo
```

הכלי מוחק רק חשבון שמזוהה כתצפיתן ואינו מדפיס סיסמה או מפתח.

## ראיות חזותיות

הצילומים נשמרו תחת `qa-evidence/digital-observer-auth-flow`:

- `register-desktop-1440.jpg`
- `register-mobile-390.jpg`
- `verify-mobile-390.jpg`
- `onboarding-desktop-1440.jpg`
- `onboarding-mobile-390.jpg`
- `onboarding-package-mobile-390.jpg`

## החלטה

הפרדת המסלולים ותיקוני הקוד מוכנים. בדיקת רישום חדשה עם מייל אמיתי עדיין חסומה על ידי שתי פעולות חיצוניות: החלת המיגרציה החדשה והפעלת ספק המייל ב-Supabase. אין להפעיל תשלום, מצלמה חיה, AI חי, SMS או WhatsApp במסגרת הבדיקה הזו.
