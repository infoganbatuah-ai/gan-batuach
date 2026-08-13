# DEMO AUTH CREDENTIALS 1 - עדכון לפי בקשת דניאל

## מה דניאל ביקש

להכין משתמשי בדיקה ברורים לפי מצבי שיוך:

- פקח/ית מוקצה/ת לגן
- פקח/ית לא מוקצה/ת
- הורה מוקצה/ת לגן
- הורה לא מוקצה/ת
- צוות מוקצה לגן
- צוות לא מוקצה
- פרטים ברורים לכל משתמש בדיקה
- הבהרה מהו משתמש Digital Observer

## משתמשי בדיקה מומלצים

| מצב | אימייל בדיקה | שיוך | פרטים |
|---|---|---|---|
| הורה מוקצה | `parent.1@demo.ganbatuach.com` | גן רקפת הקטנה | הורה עם ילד/ה דמו. משמש לבדיקה שהורה רואה רק את הילד שלו. |
| הורה לא מוקצה | `qa.parent.unassigned@demo.ganbatuach.com` | אין | הורה ללא ילד/גן. משמש לבדיקת מצב ריק/בקשת רישום. |
| צוות מוקצה | `staff.1@demo.ganbatuach.com` | גן רקפת הקטנה | איש/אשת צוות עם שיוך פעיל לגן. |
| צוות לא מוקצה | `qa.staff.unassigned@demo.ganbatuach.com` | אין | צוות ללא גן. אמור לראות מצב "עדיין לא שובצת לגן". |
| פקח/ית מוקצה/ת | `inspector.yael@demo.ganbatuach.com` | גן רקפת הקטנה + גן אורנים הירוק | פקחית עם גנים משויכים. |
| פקח/ית לא מוקצה/ת | `qa.inspector.unassigned@demo.ganbatuach.com` | אין | פקחית ללא גנים. אמורה לראות מצב בקשה/המתנה. |
| אדמין | `admin-demo@demo.ganbatuach.com` | מערכת | אדמין דמו לניהול ובדיקות. |
| Digital Observer | `qa.digital.observer@demo.ganbatuach.com` | אתר תצפית דמו | משתמש אפליקטיבי ל-Digital Observer, לא משתמש Supabase Dashboard. |

## סטטוס סיסמאות מקומיות לפי בדיקה

נמצאו עכשיו סיסמאות מקומיות לפי שם משתנה עבור:

- הורה מוקצה
- מנהלת
- צוות מוקצה
- פקחית מוקצה
- הורה לא מוקצה
- צוות לא מוקצה
- פקחית לא מוקצה
- Digital Observer
- אדמין

לא הודפסו ערכי סיסמאות, והן נשארות רק בקובץ המקומי `.env.qa-demo.local`.

חסרים עדיין פרטי Supabase server-side להרצת סקריפט יצירה אוטומטי:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## תשובה לשאלה על Digital Observer

משתמש Digital Observer לצורך QA הוא לא משתמש ה-Supabase Dashboard שלך.

זה משתמש Auth של האפליקציה, שנכנס דרך מסך הכניסה של גן בטוח / Digital Observer.

אפשר להשתמש במייל האישי שלך רק אם הוא מוגדר גם בתוך האפליקציה עם:

- רשומת `profiles`;
- role מתאים;
- שיוך ל-`observer_sites`;
- שיוך ל-`observer_site_memberships`.

אבל לצורך QA נקי עדיף להשתמש במשתמש דמו נפרד:

`qa.digital.observer@demo.ganbatuach.com`

## החלטה

אפשר להריץ QA חלקי למשתמשים שכבר קיימים בפועל ב-Supabase.

לא להריץ QA מלא לכל התפקידים עד יצירת/אימות המשתמשים הלא-משויכים ו-Digital Observer בתוך Supabase.
