# מטריצת משתמשי בדיקה לדניאל

אין לפרסם או לשמור כאן סיסמאות. יש למלא סיסמאות רק בקובץ מקומי מוחרג מגיט: `.env.qa-demo.local`.

## משתמשים מומלצים ל-QA מחובר

| תפקיד בדיקה | אימייל מומלץ | מצב שיוך | גן/אתר משויך | מה אמור להופיע אחרי כניסה | משתנה סיסמה מקומי |
|---|---|---|---|---|---|
| הורה משויך | `parent.1@demo.ganbatuach.com` | משויך | גן רקפת הקטנה, ילד/ה דמו של Parent A | דשבורד הורה עם ילד/ה דמו, בלי ילדים של הורה אחר | `QA_DEMO_PARENT_ASSIGNED_PASSWORD` או `QA_DEMO_PARENT_PASSWORD` |
| הורה לא משויך | `qa.parent.unassigned@demo.ganbatuach.com` | לא משויך | אין | מצב הורה בלי ילדים/בלי בקשת רישום פעילה | `QA_DEMO_PARENT_UNASSIGNED_PASSWORD` |
| מנהלת גן | `manager.rakefet@demo.ganbatuach.com` | משויכת | גן רקפת הקטנה | דשבורד מנהלת של גן רקפת בלבד | `QA_DEMO_MANAGER_PASSWORD` |
| צוות משויך | `staff.1@demo.ganbatuach.com` | משויך | גן רקפת הקטנה | דשבורד צוות פעיל עם משמרות/משימות דמו | `QA_DEMO_STAFF_ASSIGNED_PASSWORD` |
| צוות לא משויך | `qa.staff.unassigned@demo.ganbatuach.com` | לא משויך | אין | מסך "עדיין לא שובצת לגן" / חיפוש גנים | `QA_DEMO_STAFF_UNASSIGNED_PASSWORD` |
| פקח/ית משויך/ת | `inspector.yael@demo.ganbatuach.com` | משויכת | גן רקפת הקטנה + גן אורנים הירוק | דשבורד פיקוח עם גנים משויכים בלבד | `QA_DEMO_INSPECTOR_ASSIGNED_PASSWORD` |
| פקח/ית לא משויך/ת | `qa.inspector.unassigned@demo.ganbatuach.com` | לא משויכת | אין | מסך בקשת פקח/ית או המתנה לאישור | `QA_DEMO_INSPECTOR_UNASSIGNED_PASSWORD` |
| אדמין | `admin-demo@demo.ganbatuach.com` | אדמין מערכת | כללי | דשבורד אדמין | `QA_DEMO_ADMIN_PASSWORD` |
| Digital Observer | `qa.digital.observer@demo.ganbatuach.com` | בעל אתר תצפית דמו | `[DEMO] Digital Observer QA Site` | דשבורד Digital Observer עם אתר תצפית דמו, בלי נתוני ילדים | `QA_DEMO_DIGITAL_OBSERVER_PASSWORD` |

## מה עדיין חסר לפי הבדיקה הנוכחית

נמצאו סיסמאות מקומיות עבור:

- הורה משויך / Parent קיים
- מנהלת
- צוות משויך
- פקח/ית משויך/ת
- אדמין

חסרות עדיין סיסמאות מקומיות עבור:

- הורה לא משויך
- צוות לא משויך
- פקח/ית לא משויך/ת
- Digital Observer

בנוסף, כדי ליצור משתמשים חדשים בפועל דרך הסקריפט צריך גם Supabase URL ו-service role key בקובץ מקומי. כרגע הם לא נמצאו בקובץ המקומי.

## תשובה לשאלה על Digital Observer

הכוונה אינה למשתמש שמתחבר ל-Supabase Dashboard.  
הכוונה היא למשתמש אפליקטיבי בתוך מערכת גן בטוח / Digital Observer, כלומר משתמש Auth של Supabase שמתחבר דרך מסך הכניסה של האפליקציה.

אם אתה רוצה להשתמש במייל האישי שלך כמשתמש Digital Observer באפליקציה, אפשר, אבל צריך לוודא שיש לו:

- רשומת `profiles` מתאימה;
- role מתאים שקיים במערכת;
- שיוך ל-`observer_sites` דרך `observer_site_memberships`;
- ללא גישה לנתוני ילדים/גנים שאינם שייכים לו.

ל-QA נקי עדיף משתמש דמו נפרד: `qa.digital.observer@demo.ganbatuach.com`.
