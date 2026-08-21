# תוצאת הכנת משתמש פיילוט אדמין לתצפיתן

תאריך: 2026-08-21

## תוצאה

`CREATED_AND_SCOPED_FOR_DIGITAL_OBSERVER_ADMIN`

- שם המשתמש המתוכנן: `info.ganbatuah+observer-admin@gmail.com`
- תפקיד מתוכנן: `digital_observer_admin` בלבד
- הרשאת אדמין כללית בגן בטוח: לא
- סיסמה הודפסה או נכתבה בדוח: לא
- הסיסמה הזמנית לא הודפסה ולא נשמרה בדוח או ב-Git; היא תוחלף דרך קישור recovery חד-פעמי
- חשבון נוצר בפועל: כן
- מזהה משתמש אומת מול Supabase: כן
- הרשאת `digital_observer_admin` חתומה ב-`app_metadata`: כן
- חשבון `digital_observer_accounts`: קיים, עסקי, פעיל, onboarding הושלם
- מצב חיוב: `payment_method_pending` ללא חיוב פעיל

## מה בוצע ואומת

נוצר משתמש פיילוט סינתטי ב-Supabase Auth והוגדרה לו הרשאת מוצר חתומה `digital_observer_admin=true`. פרופיל גן בטוח שלו נשאר במכוון בתפקיד `parent`, ללא `garden_id` וללא הרשאת admin כללית. במקביל נוצרה רשומת `digital_observer_accounts` עסקית עם תחום `digital_observer_only`, נתונים סינתטיים בלבד וללא שירותים חיים.

מפתח הניהול החדש נשמר כמשתנה שרת רגיש ב-Vercel בלבד. הוא לא הודפס, לא נכתב בדוח, לא הוכנס ל-frontend ולא הוכנס ל-Git.

מוכן גם מסלול חד-פעמי להגדרת סיסמה:

- `scripts/qa/send-digital-observer-admin-set-password.mjs`
- `/digital-observer/set-password`

## הפעולה הידנית המינימלית שנותרה

לאחר הפריסה יישלח למייל החשבון קישור recovery חד-פעמי. דניאל צריך לפתוח את ההודעה, להגדיר סיסמה אישית בעמוד `/digital-observer/set-password`, ולהיכנס דרך `/digital-observer/login`. הסיסמה הזמנית לא נמסרה ולא נשמרת בדוח.

מצלמות, AI, הודעות, חיוג, חיוב וספקים חיים לא הופעלו.
