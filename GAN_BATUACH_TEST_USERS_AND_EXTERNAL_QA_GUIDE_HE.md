# גן בטוח - משתמשי בדיקה ומדריך QA חיצוני

עדכון אחרון: 20 באוגוסט 2026. כל תשעת המשתמשים התחברו בהצלחה בבדיקת Supabase אמיתית ובבדיקת Browser רגילה.

כל המשתמשים והנתונים במסמך זה סינתטיים. הסיסמאות נמצאות רק ב-`.env.qa-demo.local`, קובץ מקומי שמוחרג מ-Git. אין לשלוח אותו במייל, לצרף לצילום מסך או להעלות למערכת ניהול קוד. ל-QA חיצוני מוסרים סיסמאות בערוץ מאובטח ונפרד.

## רשימת משתמשים סופית

| מזהה QA | אימייל | תפקיד | שיוך | מסך כניסה צפוי |
|---|---|---|---|---|
| `parent_assigned` | `parent.1@demo.ganbatuach.com` | הורה | 4 ילדים סינתטיים; גן רקפת הקטנה וגן שקד וחברים | `/dashboard/parent/family-home` |
| `parent_unassigned` | `qa.parent.unassigned@demo.ganbatuach.com` | הורה | ללא ילד וללא גן | `/dashboard/parent` |
| `manager` | `manager.rakefet@demo.ganbatuach.com` | מנהלת | גן רקפת הקטנה | `/dashboard/garden` |
| `staff_assigned` | `staff.1@demo.ganbatuach.com` | צוות | גן רקפת הקטנה | `/dashboard/staff` |
| `staff_unassigned` | `qa.staff.unassigned@demo.ganbatuach.com` | צוות | ללא גן | `/dashboard/staff` |
| `inspector_assigned` | `inspector.yael@demo.ganbatuach.com` | מפקחת | גן רקפת הקטנה וגן אורנים הירוק | `/dashboard/inspector/control-center` |
| `inspector_unassigned` | `qa.inspector.unassigned@demo.ganbatuach.com` | מפקחת | לא פעילה, ללא גן | `/dashboard/inspector/apply` |
| `admin` | `admin-demo@demo.ganbatuach.com` | אדמין | סביבת Demo מלאה | `/dashboard/admin` |
| `digital_observer` | `qa.digital.observer@demo.ganbatuach.com` | `network_manager` | אתר סינתטי Digital Observer | `/digital-observer/dashboard` |

## שיטת התחברות בטוחה

1. פותחים `/api/auth/logout` לפני מעבר בין תפקידים.
2. ממתינים למסך הכניסה ומתחברים דרך `/login` עם המשתמש הבא.
3. משתמשים בחלון Incognito או בפרופיל דפדפן נפרד כאשר בודקים כמה תפקידים במקביל.
4. מוודאים בכותרת ובתפריט שהתקבל התפקיד הצפוי.
5. אין לשנות user id, cookie או role ידנית ואין להשתמש ב-Service Role בדפדפן.

## תסריט QA חיצוני לכל תפקיד

### הורה משויך

- רואה רק את ילדיו הסינתטיים.
- פותח פרופיל ילד, משפחה, מסמכים, הודעות, לוח, תשלום ומצלמות.
- תשלום חייב להציג manual/readiness ולא הצלחה חיה.
- מצלמות חייבות להציג נעילה/readiness, ללא RTSP או live מזויף.
- אין אירוע AI גולמי.

### הורה לא משויך

- מקבל מצב ריק ברור והנחיית פעולה.
- אינו רואה ילדים, מסמכים או מצלמות של גן כלשהו.
- אינו יכול לנחש URL ולקבל נתוני משפחה אחרת.

### מנהלת

- רואה רק את גן רקפת הקטנה ואת הנתונים הסינתטיים שלו.
- בודקת ילדים, צוות, נוכחות, משימות, בקשות רישום, מסמכים, דוחות, כספים ומצלמות.
- כל פעולה שאינה חיה חייבת להציג הסבר readiness ולא הצלחה מזויפת.

### צוות משויך ולא משויך

- משויך: רואה רק הקשר עבודה של גן רקפת הקטנה.
- לא משויך: אינו רואה ילדים/הורים ומקבל מסך שיוך/חיפוש עבודה ברור.
- בודקים נוכחות, משימות, משמרות, הודעות ומסמכים.

### מפקחת משויכת ולא משויכת

- משויכת: רואה רק את שני הגנים הסינתטיים שהוגדרו לה.
- לא משויכת: אינה רואה גנים או ילדים.
- בודקים פתיחת ביקורת, טופס, ממצאים, שמירה, היסטוריה ודוח readiness.

### אדמין

- בודק אישורים, משתמשים, גנים, ספקים, תשלומים, מצלמות, AI ומוכנות פיילוט.
- אסור שיופיעו מפתחות, tokens, RTSP, credentials או provider payload גולמי.
- סטטוס ספק חסר אינו יכול להיות ירוק/חי.

### Digital Observer

- בודק הפרדה מגן בטוח, אתר סינתטי, מצלמות, התרעות, הגדרות וחיוב readiness.
- תיקון ה-RLS הוחל; אין עוד `42P17` והאתר הסינתטי נטען.
- זהו משתמש מוצר רגיל עם הרשאת `network_manager`, לא משתמש Supabase Dashboard ולא חשבון האדמין האישי של דניאל.
- השירותים נשארים Readiness/Shadow; אין מצלמה או AI חי.

## מטריצת מסכים

לכל תפקיד בודקים לפחות: 390x844, 768x1024 ו-1440x900. בכל מסך מאשרים:

- אין גלילה אופקית.
- אין כפתור/CTA חתוך.
- התוכן אינו מוסתר מתחת ל-header או bottom navigation.
- כל כפתור עובד, חסום עם סיבה, או פותח מצב readiness אמיתי.
- אין ערך תאריך/מספר קבוע שאינו מגיע מנתון או ממצב ריק.
- אין הבטחת live, תשלום, מצלמה, AI או הודעה שלא בוצעה בפועל.

## ראיות קיימות

- צילומי המסך: `qa-evidence/gan-batuach-completion-audit-1/`
- תוצאות בדיקות תפקיד: קובצי `*-audit.json` באותה תיקייה.
- בדיקות גבולות Supabase: `role-boundary-probes.json`.
- התוצאה הנוכחית: 9/9 logins ו-9/9 assertions; sentinel סינתטי ב-Storage נחסם לכל תפקידי הדפדפן ונמחק בסיום.
- פקודת הרצה חוזרת בכל סביבת Pilot חדשה: `npm run qa:probe-role-boundaries`.
- בדיקת הזרימה החדשה: `npm run qa:manager-parent-live-contract`.
- ראיות רישום/ניווט סופיות: `qa-evidence/manager-registration-live-flow/`.

## כלל למסירת QA חיצוני

מוסרים את כתובות האימייל מהטבלה ואת הסיסמאות בערוץ מאובטח נפרד. אין לצרף `.env.qa-demo.local`, אין לצלם סיסמה ואין לתת גישה ל-Supabase Dashboard. QA חיצוני משתמש רק ב-`/login` וב-`/api/auth/logout` בין תפקידים.
