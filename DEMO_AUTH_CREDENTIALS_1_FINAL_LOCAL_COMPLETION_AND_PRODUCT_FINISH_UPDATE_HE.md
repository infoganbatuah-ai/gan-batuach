# DEMO AUTH CREDENTIALS 1 - השלמת סיסמאות מקומית ועדכון פינישים

## סטטוס משתמשי בדיקה

קובץ הסיסמאות המקומי `.env.qa-demo.local` קיים ומוגן על ידי `.gitignore`.

כל משתני האימייל והסיסמה הנדרשים לבדיקות QA קיימים עכשיו בקובץ המקומי לפי שם משתנה בלבד. ערכי הסיסמאות לא הודפסו ולא הוכנסו לקובץ שמיועד ל-git.

## משתמשי הבדיקה שהוגדרו

| תפקיד | אימייל בדיקה | שיוך צפוי |
|---|---|---|
| הורה משויך | `parent.1@demo.ganbatuach.com` | גן רקפת הקטנה / ילד דמו |
| הורה לא משויך | `qa.parent.unassigned@demo.ganbatuach.com` | ללא גן וללא ילד |
| מנהלת | `manager.rakefet@demo.ganbatuach.com` | גן רקפת הקטנה |
| צוות משויך | `staff.1@demo.ganbatuach.com` | גן רקפת הקטנה |
| צוות לא משויך | `qa.staff.unassigned@demo.ganbatuach.com` | ללא גן |
| פקחית משויכת | `inspector.yael@demo.ganbatuach.com` | גן רקפת הקטנה + גן אורנים הירוק |
| פקחית לא משויכת | `qa.inspector.unassigned@demo.ganbatuach.com` | ללא גן |
| אדמין | `admin-demo@demo.ganbatuach.com` | מערכת |
| Digital Observer | `qa.digital.observer@demo.ganbatuach.com` | אתר תצפית דמו |

## מה עדיין חסום

Codex לא יצר בפועל את המשתמשים החסרים בתוך Supabase, כי חסרים מקומית פרטי חיבור שרתיים:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

בלי שני הערכים האלה אי אפשר להריץ בבטחה את סקריפט יצירת המשתמשים. אין להשתמש ב-service role בדפדפן או בקוד לקוח.

## Digital Observer

Digital Observer הוא לא משתמש Supabase Dashboard.

זה משתמש רגיל של האפליקציה, שנכנס דרך מסך הכניסה הרגיל אל:

`https://gan-batuach.vercel.app/digital-observer/dashboard`

מטרת המשתמש היא לבדוק את מוצר "התצפיתן הדיגיטלי": אתרים, מצלמות במצב מוכנות, תור סקירה, חיוב/מוכנות והפרדה מגן בטוח.

## תיקוני פיניש שבוצעו עכשיו

בוצעו שני תיקוני UX/Layout בטוחים:

1. הוסרה טעינה כפולה של `app-shell.css` מתוך `app/globals.css`, כדי לצמצם התנגשויות CSS.
2. `MobilePublicTabs` הוגבל למסכים ציבוריים בלבד, כדי שניווט ציבורי תחתון לא יכסה דשבורדים מחוברים או מסכי מערכת.

התיקונים לא משנים הרשאות, לא עוקפים Auth/RLS, לא מפעילים תשלומים, מצלמות, AI או WhatsApp/SMS.

## סטטוס להמשך

אפשר להמשיך רק אחרי אחד משני מסלולים:

1. דניאל מוסיף מקומית את פרטי Supabase השרתיים ומבקש להריץ את `npm run qa:create-demo-role-users`.
2. דניאל יוצר/מאמת ידנית ב-Supabase את המשתמשים הלא משויכים ואת משתמש Digital Observer.

אחרי זה אפשר להריץ AUTHED UX/UI QA 3 מלא.

## החלטה

DEMO_CREDENTIALS_LOCAL_READY_SUPABASE_USER_CREATION_REQUIRED

הפינישים הראשונים לרספונסיביות בוצעו, אבל עדיין חובה להריץ QA חזותי מחובר לכל התפקידים לפני חזרה להכנת פיילוט מבוקר.
