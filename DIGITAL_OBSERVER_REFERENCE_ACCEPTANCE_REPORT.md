# תצפיתן דיגיטלי - דוח קבלה עובדתי מול שבע תמונות הייחוס

תאריך: 23.08.2026

סביבה: build מקומי במצב production, חשבונות QA סינתטיים ביתי, עסקי ואדמין ייעודי לתצפיתן

שירותים חיים שהופעלו: אין

Push / deploy: לא בוצעו

## החלטה נוכחית

**REFERENCE_ACCEPTANCE_OPEN_DANIEL_VISUAL_REVIEW_REQUIRED**

דניאל דחה את מסקנת הקבלה הקודמת לאחר צפייה ישירה בלוחות ההשוואה. לכן כל שבעת הרפרנסים פתוחים מחדש, והעבודה מתבצעת מסך-מסך לפי קומפוזיציה, מידות, צפיפות, מדיה, ניווט והתנהגות במובייל ובדסקטופ. קיום route או רכיב בעל שם דומה אינו נחשב עוד לקבלה.

אין בדוח טענה לזהות פיקסלית או להפעלה חיה. כאשר הרפרנס מציג LIVE, Push, ביומטריה, חיוב או נתון תפעולי שאינו מחובר לתשתית מאושרת, היישום מציג מצב demo/readiness אמין. אין להחליף אותו בנתון מזויף רק כדי להעתיק צילום.

שער הפרסום נשאר סגור: אין commit, push או deploy במסגרת הסבב הזה.

## ראיות עדכניות

- סבב ההשוואה הקובע כעת: `qa-evidence/digital-observer-reference-refactor-active-226-panel-pairs` - שבעה לוחות כלליים ולוחות panel-by-panel לאחר תיקון יחס מעטפות ההשוואה, צפיפות הדשבורדים ב-1024x630, קומפוזיציית מובייל 390/430 ואשף המצלמה. כל שבעת הלוחות עדיין `OPEN` עד צפייה וקבלה מפורשת של דניאל.
- דשבורד דסקטופ עדכני: `qa-evidence/digital-observer-reference-refactor-active-224-desktop-density` - בדשבורד הבית hero, ארבע מצלמות, ארבעה אירועים ומצב הבית נכנסים ל-first fold; בדשבורד העסק המדדים, האירועים, מצב הפעילות ורצועת המצלמות נכנסים ללא חיתוך.
- מובייל עדכני: `qa-evidence/digital-observer-reference-refactor-active-225-mobile-final/REPORT.md` - 11 מצבי דשבורד ואשף מצלמה ב-390/430, ללא overflow או מעטפת breakpoint שגויה. אשף המצלמה משתמש בסרגל זרימה עליון ללא bottom navigation, בהתאם לרפרנס, ולא בדסקטופ מוקטן.
- אמת תפקודית עדכנית: `qa-evidence/digital-observer-functional-reality-active-227/REPORT.md` - 36/36 מסכי בית ועסק במובייל ובדסקטופ, אפס overflow, קישורים מתים, שגיאות console או כשלי אינטראקציה. לא הופעלו ספקים חיים, מצלמות, AI, חיוב או פעולות הרסניות.
- דסקטופ רחב: `qa-evidence/digital-observer-reference-refactor-active-228-desktop-wide/REPORT.md` - דשבורדי הבית והעסק ב-1366x768 וב-1440x900, ללא stretch של mobile וללא overflow. ההיררכיה נשמרת גם ב-first load ברוחב מלא.
- מסכים משניים בדסקטופ: `qa-evidence/digital-observer-reference-refactor-active-229-secondary-desktop/REPORT.md` - התראות, פרט אירוע, timeline, הקלטות, אנשים, בחירת מנוי, תשלום מוכנות והגדרות ב-1366/1440. כל 16 המצבים עברו את שער המעטפת והגלישה.
- פרט אירוע: `qa-evidence/digital-observer-reference-refactor-active-230-event-fold` - יחס המדיה במסך רחב וקצר תוקן כך שהראיה, ציר הזמן וארבע פעולות ההחלטה מוצגים יחד במסך הראשון כמו ברפרנס. הפעולות אינן מבצעות הסלמה חיה.
- אשף המצלמה בקנבס האנכי: `qa-evidence/digital-observer-reference-refactor-active-206-camera-scale` - כותרת דינמית לכל שלב, כרטיסי חיבור מוגדלים, טבלת בדיקת חיבור, preview, מטרות ניטור וסיכום מצלמה בקנה המידה של המקור. לא נוצרה מצלמה ולא הופעל stream.
- לוח המובייל: `qa-evidence/digital-observer-reference-refactor-active-197-mobile` ו-`qa-evidence/digital-observer-reference-refactor-active-198-mobile-flow` - כניסה, בית, התראת מובייל, פרט מצלמה, הוספת מצלמה והגדרות ב-390/430. חומרת אירוע ומצב ספק נשארים נאמנים לנתוני QA ואינם נצבעים כחיים לצורך התאמה לתמונה.
- מרכז ההתראות, הקלטות ואנשים: `qa-evidence/digital-observer-reference-refactor-active-194-alerts-people` ו-`qa-evidence/digital-observer-reference-refactor-active-195-people` - חיפוש GET אמיתי ב-topbar, כרטיסי אנשים, פרטיות וטבלת שיוך מצלמות באותו קנבס.
- מנוי, הגדרות ואדמין: `qa-evidence/digital-observer-reference-refactor-active-200-billing-settings` ו-`qa-evidence/digital-observer-admin-reference-active-210` - מסלול, תשלום במוכנות, שלוש עמודות הגדרות ומרכז ניהול ייעודי. ה-first fold כולל ארבעה KPI, ניהול מסלולים, התראות מערכת, חלוקת מסירות, פעילות וקיצורים; אין מספרי הצלחה מומצאים.
- כניסה ו-onboarding: `qa-evidence/digital-observer-reference-refactor-active-203-auth-public` ו-`qa-evidence/digital-observer-reference-refactor-active-204-auth-flow` - login, בחירת בית/עסק וארבעה שלבים לכל מסלול בקנבס 840x2248, ללא שמירת נתונים.
- אמת תפקודית אחרי הסבב: `qa-evidence/digital-observer-reference-refactor-active-208-functional/REPORT.md` - 36/36 מצבי מסלול ביתי ועסקי במובייל ובדסקטופ, ללא overflow, קישור מת, שגיאת console או כשל ניתוב.
- מסכי ההרשמה וה-onboarding ביחס המקור: `qa-evidence/digital-observer-reference-refactor-active-179-auth-position` ו-`qa-evidence/digital-observer-reference-refactor-active-180-auth-position-public` - ארבעה שלבי בית, ארבעה שלבי עסק, מסך כניסה ובחירת סוג חשבון ב-840x2248. תצוגות המכשיר הועלו למיקום התואם יותר לקומפוזיציה האנכית של המקור; הן HTML/CSS אמיתי, אינן צילום סטטי ואינן מציגות נתון תפעולי מומצא.
- סיכום אשף המצלמה: `qa-evidence/digital-observer-reference-refactor-active-171-camera-summary` - מדיה רחבה, ארבע פעולות מוכנות, פרטי מצלמה ואזור אירועים במצב readiness. אין תווית LIVE, זמן אירוע או הצלחת חיבור מומצאים.
- אמת תפקודית אחרי התיקונים האחרונים: `qa-evidence/digital-observer-reference-refactor-active-178-functional/REPORT.md` - 36/36 מצבי מסלול ביתי ועסקי במובייל ובדסקטופ, ללא overflow, קישור מת, שגיאת console או כשל ניתוב.
- תיקון ממוקד למובייל: `qa-evidence/digital-observer-reference-refactor-active-161-mobile-home` ו-`qa-evidence/digital-observer-reference-refactor-active-160-mobile-proportions` - אזור מצב הבית ושלוש מצלמות מלאות מקבלים את ה-first fold כמו ברפרנס, וכרטיס הפרופיל קיבל משקל אנכי תואם יותר. אין overflow והניווט התחתון נשאר נגיש.
- תיקון מדיה וקומפוזיציה למסך הכניסה: `qa-evidence/digital-observer-reference-refactor-active-162-auth-media` ו-`qa-evidence/digital-observer-reference-refactor-active-163-auth-composition` - רקע הבית נוצר כנכס צילום נקי ללא טקסט או UI, הכותרת הוזזה מעל הכרטיס ואינה מוסתרת, וגרסת 390px נשארת עצמאית מהדסקטופ.
- אימות קנה מידה למסכי onboarding: `qa-evidence/digital-observer-reference-refactor-active-158-onboarding-scale` - שלבי הבית והעסק ב-840x1767 משתמשים בגובה ובצפיפות של קנבס הרפרנס במקום בטופס קטן במרכז.
- אמת תפקודית לאחר כל תיקוני היחסים והמדיה: `qa-evidence/digital-observer-reference-refactor-active-165-functional/REPORT.md` - 36 מצבי מסלול מחוברים לבית ולעסק, במובייל ובדסקטופ; אפס overflow, קישורים מתים, שגיאות console או כשלים. נפתחו בפועל תפריט מובייל, פרט מצלמה, פרט אירוע ואתר, בלי להפעיל שירות חיצוני או פעולה הרסנית.
- סבב ההשוואה העדכני: `qa-evidence/digital-observer-reference-refactor-active-153-comparisons` - שבעה לוחות כלליים ושבעה לוחות detail, עם אותם crop-ים, grid ויחסי קנבס בשני הצדדים. לוח המובייל משתמש במעטפת מכשיר ולוחות 2 ו-7 משתמשים במעטפת דפדפן רק ככלי QA; המעטפות אינן חלק מה-DOM של המוצר. מעטפת הדפדפן שומרת כעת גם על יחס ה-portrait המקורי ואינה מותחת את הצילום על חצי לוח.
- אימות ממוקד עדכני לאשף המצלמה: `qa-evidence/digital-observer-reference-refactor-active-150-camera-actions` - דסקטופ אנכי ו-390px, עם פס שלבים יחיד בכל breakpoint, sidebar ביחס צר יותר, כרטיסי חיבור בקצב גבוה יותר וסדר המשך/חזרה/ביטול זהה לכיוון הפעולות ברפרנס. 16 הצילומים נוצרו בלי לשלוח onboarding או ליצור מצלמה.
- אימות ממוקד למסך הכניסה ובחירת סוג החשבון: `qa-evidence/digital-observer-reference-refactor-active-152-auth-density` - כרטיס הכניסה נכנס במלואו ל-first fold של 390/430, קישור אימות מוצג רק כאשר הרשמה או שגיאת אימות אכן דורשות אותו, ותצוגת הדסקטופ שומרת את המכשיר החופף שנבנה ב-HTML/CSS. Google נשאר מושבת ומסומן עד חיבור ספק.
- אימות ממוקד לאחר תיקון יחס הקנבס וצפיפות המובייל: `qa-evidence/digital-observer-reference-refactor-active-139-canvas-mobile` ו-`qa-evidence/digital-observer-reference-refactor-active-141-density-payment` - sidebar מלא ברוחב מאוזן ב-1024, hero נקי במובייל, רשימת מצלמות צפופה יותר ומסך תשלום דו-עמודי כמו ברפרנס.
- דשבורדים לאחר תיקון יחס ה-first fold: `qa-evidence/digital-observer-reference-refactor-active-111-dashboard-fold` - ביתי ועסקי ב-1024x630 וב-1366x768. שורת המדדים/hero, אזור המדיה, האירועים ורצועת המצלמות מוצגים יחד ללא resize ידני וללא חיתוך.
- אשף המצלמה ביחס הקנבס האנכי של הרפרנס: `qa-evidence/digital-observer-reference-refactor-active-150-camera-actions` - ארבעת השלבים ב-840x1767, עם sidebar מלא שאינו שובר את המותג, תוכן גליל, פס שלבים יחיד ופעולות תחתונות נגישות ובסדר הנכון.
- אשף המצלמה במובייל: `qa-evidence/digital-observer-reference-refactor-active-123-camera-mobile-final` - זרימת מובייל ייעודית ב-390x844 עם חץ חזרה, שלושה שלבים חזותיים, איור מצלמה והילה; הניווט התחתון מוסתר בזמן הזרימה והפעולות אינן נחתכות.
- התחברות ובחירת מסלול ביחס הקנבס האנכי: `qa-evidence/digital-observer-reference-refactor-active-105-auth-canvas` - שני מסכים ציבוריים ב-840x1767.
- onboarding ביתי ועסקי ביחס הקנבס האנכי: `qa-evidence/digital-observer-reference-refactor-active-106-auth-flows` - 16 צילומי זרימה, ללא שליחת נתונים או הפעלת שירות.
- אדמין ביחס הקנבס של הרפרנס: `qa-evidence/digital-observer-admin-reference-active-85` - 15 צילומים. ב-1024x630 מוצגים ארבעה KPI אמינים, שלושת אזורי הניהול, מפת מיקומים ומגמת אירועים בקומפוזיציה צפופה; אין מספרים ירוקים מומצאים.
- אמת תפקודית אחרי התיקונים: `qa-evidence/digital-observer-reference-refactor-active-154-functional/REPORT.md` - 36 מצבי מסלול מחוברים של ביתי ועסקי במובייל ובדסקטופ, אפס overflow, קישורים מתים, שגיאות console או כשלים. נפתחו גם תפריט מובייל, פרט מצלמה, פרט אירוע ואתר.
- סבב responsive מלא לאחר תיקון יחס הקנבס והצפיפות: `qa-evidence/digital-observer-reference-refactor-active-78-unified/REPORT.md` - 254 צילומים ביתי/עסקי/ציבורי, בשש רזולוציות, ללא כשל layout אוטומטי.
- זרימות רב-שלביות: `qa-evidence/digital-observer-reference-refactor-active-78-flows/REPORT.md` - 32 צילומים של onboarding ואשף מצלמה, בלי שמירת נתון או הפעלת שירות.
- אדמין ייעודי: `qa-evidence/digital-observer-reference-refactor-active-71-admin/REPORT.md` - 14 צילומים, ללא overflow, מסך שגיאה או שכבת פיתוח.
- אמת תפקודית לאחר תיקוני `active-80`: `qa-evidence/digital-observer-functional-reality-active-80/REPORT.md` - 36 מצבי מסלול מחוברים של ביתי ועסקי במובייל ובדסקטופ, אפס קישורים מתים, overflow, שגיאות console או כשלים.
- אימות ממוקד לאשף המצלמה לאחר תיקון מיקום הגלילה: `qa-evidence/digital-observer-reference-refactor-active-78-camera` - 16 צילומים בדסקטופ ובמובייל.
- קישור מדיה לאירועים: `qa-evidence/digital-observer-reference-refactor-active-79-data-link/REPORT.md` - 24 צילומים שמאמתים שאירועי QA מציגים את מקור המצלמה הסינתטי המתאים במקום תמונה חוזרת, ללא טענת וידאו חי.
- תצוגת מצלמה ממוקדת במובייל: `qa-evidence/digital-observer-reference-refactor-active-80-mobile-camera/REPORT.md` - 6 צילומים ב-390, 430 ו-1440; פעולות המצלמה והניווט נשארים נגישים ללא overflow.
- השוואות קודמות נשמרות כראיה היסטורית. ההשוואה הישירה הקובעת כעת היא `active-226-panel-pairs`, שמשלבת את תיקוני הדשבורדים, אשף המצלמה, מרכז ההתראות, המובייל, המנוי, האדמין וה-auth/onboarding האחרונים.

התוצאה האוטומטית של הסבבים היא `PASS`, אך היא מוכיחה רק יציבות, נגישות מסלולים ורספונסיביות טכנית. היא אינה מחליפה קבלה ידנית של ההתאמה לתמונות.

## ראיות קודמות שאינן מהוות קבלה

- סבב מלא: `qa-evidence/digital-observer-reference-refactor-active-25/REPORT.md` - 230 צילומים. תוצאת `PASS` האוטומטית אינה קבלה חזותית והיא מבוטלת לצורך שער השחרור.
- השוואה ישירה: `qa-evidence/digital-observer-reference-refactor-active-25/comparisons` - שבעה לוחות כלליים ושבעה לוחות detail.
- אימות דסקטופ ממוקד לאחר תיקון הסקייל: `qa-evidence/digital-observer-reference-refactor-active-24/REPORT.md` - 56 צילומים, `PASS`.
- אימות מובייל ממוקד: `qa-evidence/digital-observer-reference-refactor-active-24-mobile/REPORT.md` - 38 צילומים, `PASS`.
- אדמין: `qa-evidence/digital-observer-admin-reference-active-6/REPORT.md` - 14/14, `PASS`.
- אמת תפקודית: `qa-evidence/digital-observer-functional-reality-active-5/REPORT.md` - 36/36, אפס כשלים.

## סטטוס רפרנס אחר רפרנס בזמן השחזור

| # | רפרנס | מה קיים כרגע | סטטוס קבלה |
|---|---|---|---|
| 1 | דשבורד עסקי | sidebar ו-topbar, חמישה מדדים, גרף, אירועים פתוחים ופס מצלמות נכנסים ל-first fold ב-1024x630 וב-1366x768; אתרים, גריד מצלמות ומטריצת הרשאות זמינים | פתוח - נדרשת קבלת דניאל להשוואה החזותית העדכנית |
| 2 | הוספת מצלמה | אשף ארבעה שלבים, preview מוכנות, יעדי ניטור וסיכום מצלמה עם מדיה, פעולות, פרטים ואירועים במוכנות; פעולות תחתונות נגישות בדסקטופ ובמובייל | פתוח - נדרשת קבלת דניאל; stream נשאר חסום עד Gateway |
| 3 | דשבורד ביתי | hero, ארבע מצלמות, אירועים ומצב הבית נכנסים ל-first fold ב-1024x630 וב-1366x768; צפייה ושיחת תצפיתן זמינות | פתוח - נדרשת קבלת דניאל להשוואה הישירה בדסקטופ ובמובייל |
| 4 | אירועים, אנשים והקלטות | סינון, פרט אירוע, media readiness, timeline, retention ואנשים | פתוח - פקדי המדיה והקומפוזיציה שונו לאחר הדוח הקודם וטרם התקבלו |
| 5 | מובייל | topbar, bottom navigation ומסכים ייעודיים; אשף המצלמה שומר פעולות גלויות ב-390/430 | פתוח - נדרשת קבלה ידנית לכל אחד מששת חיתוכי המובייל |
| 6 | מנוי, הגדרות ואדמין | מסלול, חבילות, payment readiness, הגדרות ואדמין מופרד; קנבס האדמין 1024x630 תוקן לצפיפות הרפרנס | פתוח - חיוב נשאר כבוי; הנתונים האמיתיים/מצבי המוכנות שונים בכוונה מנתוני הדמה בתמונה |
| 7 | התחברות ורישום | login, בחירת בית/עסק, הרשמה ו-onboarding נפרד; צולם מחדש ביחס המקור 840x2248, כולל תצוגת מכשיר למסלול ביתי ועסקי | פתוח - נדרשת השוואה ידנית של כל שלב |

לוחות ה-detail:

- `01-business-product-detail.png`
- `02-camera-onboarding-detail.png`
- `03-home-product-detail.png`
- `04-events-people-recordings-detail.png`
- `05-mobile-product-detail.png`
- `06-billing-settings-admin-detail.png`
- `07-auth-onboarding-detail.png`

הגרסה העדכנית של כולם נמצאת תחת `qa-evidence/digital-observer-reference-refactor-active-226-panel-pairs`.

## תוצאות ההשוואה הידנית העדכנית

| # | מה נסגר בפועל | פער נראה שנותר |
|---|---|---|
| 1 | מבנה דשבורד, חמישה מדדים, גרף, אירועים, פס מצלמות, שני כרטיסי אתר, גריד מצלמות ומטריצת הרשאות; בסבב 111 תוקנו גובה המדדים, המדיה וה-first fold בנפרד ב-1024x630 וב-1366x768 | הערכים נגזרים מנתוני QA ולכן שונים מהצילום; לוח ה-detail מקטין צילום 1440 מלא מול crop מוגדל ולכן אינו מדד פיקסלי הוגן לגודל הטקסט |
| 2 | ארבעת שלבי האשף בדסקטופ ושלושה שלבים חזותיים במובייל, stepper יחיד בכל breakpoint, סוגי חיבור, בדיקת חיבור, מטרות ניטור וסיכום עשיר; מסך הסיכום כולל פעולות מהירות, פרטים ואזור אירועים בלי נתונים מומצאים; ב-390x844 הזרימה מוצגת ללא bottom navigation ועם חץ חזרה ייעודי | המדיה היא synthetic/readiness; Gateway נשאר חסום ולכן אין preview חי או טענת LIVE |
| 3 | hero ביתי, ארבע מצלמות, רשימת אירועים, מצב בית, גריד צפייה ושיחת תצפיתן; בסבבים 139 ו-141 הותאם יחס הקנבס, האיור הדסקטופי הוסר מקומפוזיציית המובייל, הרקע נוקה ורשימת המצלמות הודקה בלי להסתיר מצלמה | טקסט מצב העל ונתוני האירועים דינמיים; איור הבית נשמר בדסקטופ בהתאם לרפרנס ואינו נדחס לכרטיס המובייל |
| 4 | קטגוריות התראה בסדר הרפרנס, סינון, פרט אירוע, media readiness, timeline, הקלטות ואנשים מוכרים; אירועי QA מקושרים כעת למצלמה הסינתטית הנכונה | המדיה הסינתטית שונה מהמדיה בצילום; אין וידאו חי או פנים מומצאות |
| 5 | login, מסך בית, התראה, פרט מצלמה, הוספת מצלמה והגדרות במבנה mobile-first; מסך הבית מציג כעת שלוש שורות מצלמה מלאות בקצב הרפרנס לפני הניווט התחתון, פרופיל אנכי, כותרת `צפייה חיה` עם חזרה, פעולת התחברות נייבית ומסך זרימה ללא bottom navigation | מעטפת המכשיר בלוח היא כלי QA בלבד ואינה חלק מהאתר; חומרת ההתראה נגזרת מהאירוע הסינתטי ולכן אינה נצבעת קריטי רק כדי לחקות את המקור; Push חי נשאר כבוי |
| 6 | בחירת מסלול, מסך תשלום נפרד במוכנות, פרופיל/הגדרות ואדמין ייעודי; מסך התשלום תוקן ב-1024 לטופס וסיכום מקבילים כמו ברפרנס, ו-first fold של האדמין כולל 4 KPI וגריד ניהול/מפה/מגמה | נתוני אדמין חיים אינם מומצאים ולכן מוצגים אפסים/מצבי מוכנות במקום המדדים שבצילום; תשלום נשאר readiness |
| 7 | login עם תצלום בית ייעודי ונקי, hero, ניווט עליון, יתרונות, פוטר אבטחה ותצוגת מכשיר חופפת; בחירת בית/עסק עם האיורים ותצוגת מכשיר; onboarding ביתי ועסקי נפרדים עם stepper ותצוגת מובייל תואמת למסך | Google login שמופיע ברפרנס מוצג כפעולה מושבתת עם הסבר אמת עד חיבור ספק; שדות דירה/קומה נפתחים לפי צורך ואינם מוסרים מהמוצר |

לאחר הסריקה הידנית של שבעת לוחות `active-226-panel-pairs` ושל צילומי המקור הישירים לא נרשמה עדיין קבלת `אחד-לאחד` מצד דניאל. יחס הקנבס, מעטפות ה-QA, צפיפות הדשבורדים, כיוון הפעולות ופס השלבים באשף המצלמה, קומפוזיציית המובייל, מדיית הכניסה, התשלום, מסך סיכום המצלמה, מסלולי ההרשמה, הרכב האדמין ומיקום תצוגות המכשיר תוקנו. עדיין קיימים הבדלים מכוונים במדיה, בנתוני QA וביכולות התלויות בתשתית חיה; לכן הראיות אינן מתורגמות אוטומטית לקבלה ושער הפרסום נשאר סגור.

## תיקון הרספונסיביות בדסקטופ

ב-`app/styles/digital-observer-product.css` נוסף חוזה desktop נפרד מעל 1181px:

- רוחב תוכן עד 1280px ומרווחי עמוד קבועים.
- sidebar רספונסיבי בטווח מבוקר במקום רוחב קשיח.
- topbar, כותרות, מדדים, כרטיסי מצלמה, טבלאות ופאנלים קיבלו סקייל וצפיפות שמתאימים לרפרנס.
- מסכי טאבלט ומובייל נשארו במסלולי CSS נפרדים ולא הפכו לדסקטופ מוקטן.
- אין תלות ב-resize ידני כדי להפעיל layout.

## אמת תפקודית

| אזור | מקור אמת / פעולה | מצב ללא תשתית חיה |
|---|---|---|
| דשבורד | runtime של אתרים, מצלמות, אירועים ומנוי | נתוני QA מסומנים, ללא LIVE מזויף |
| מצלמות | API מצלמות ו-connector descriptors | הוראות ו-Gateway readiness |
| שיחת תצפיתן | conversation API והקשר אתר | shadow/readiness ללא טענת AI חי |
| אירועים | signals ופעולות review | החלטה אנושית, ללא חיוג אוטומטי |
| אנשים | known people ו-identity candidates | empty/readiness ללא פנים מומצאות |
| הקלטות | event clips ו-signed URL כשקיים | `ללא קליפ` כשאין קובץ |
| מנוי | packages, subscriptions ו-invoices | mock request בלבד, ללא חיוב |
| הגדרות | schedule, channels, recipients ו-devices | ספקים כבויים ומסומנים |

בדיקת האמת התפקודית `digital-observer-functional-reality-active-227` פתחה בפועל תפריט מובייל, פרטי מצלמה, פרטי אירוע ואתר. היא בדקה 36 מצבי מסלול של הבית והעסק במובייל ובדסקטופ, ללא overflow, קישור מת, שגיאת console או כשל. היא לא הפעילה פעולה חיצונית או הרסנית.

## בדיקות קוד ובנייה

- `npm run typecheck`: PASS.
- `npm run build`: PASS, 470 routes/pages, לאחר תיקוני `active-211`.
- `git diff --check`: PASS.
- נעילת zoom במובייל (`maximumScale: 1`): לא קיימת.
- בועת Next שחורה בצילומי production: לא קיימת.
- קבצי `page 2.tsx` או מסלולים כפולים: לא נמצאו.
- כפתורי no-op קריטיים: לא נמצאו; קישורי `#` שנמצאו הם עוגנים קיימים בתוך המסך.
- סיסמאות, tokens או secrets בדוחות: אין.

## חסמי תשתית שאינם מוסתרים

1. Gateway/DVR ו-stream אמיתי אינם מחוברים.
2. AI חי, identity pipeline וביומטריה אינם פעילים.
3. Push, Email, SMS, WhatsApp ו-Voice אינם פעילים כספקים חיים.
4. חיוב, StoreKit ו-Google Billing אינם פעילים.
5. Native QA דורש `npx cap sync`, build למכשיר וסבב מכשיר לאחר גרסה מאושרת.
6. אין אימות pixel-exact אוטומטי; שבעת לוחות ה-detail נבדקו ידנית והפערים המכוונים מפורטים כאן.

## דרישות מוצר עתידיות שנשמרו ללא הפעלה

מפת המוצר נשארת תואמת להפעלה עתידית של זיהוי אירועים, ביומטריה וזיהוי פנים, אינטגרציות למערכות מצלמות ואפליקציות תואמות ומסלולי חירום מבוקרים. הדרישות מפורטות ב-`DIGITAL_OBSERVER_24_7_RELIABILITY_ROADMAP_HE.md`. בסבב ה-UX/UI הנוכחי לא הופעלו היכולות האלה, ולא הוצג סטטוס חי מזויף. הפעלה עתידית מותנית באישור מפורש, מסגרת רגולציה ופרטיות, בחירת ספקים והוכחת אמינות מדידה.

## שער פרסום

הקוד המקומי עבר את שערי ה-layout, הרספונסיביות והאמת התפקודית. המשימה אינה מסומנת כפרוסה או כחיה. אין לבצע push או deploy עד החלטה מפורשת לאחר צפייה בלוחות ההשוואה העדכניים. כל יכולת שתלויה בתשתית חיה נשארת readiness ולא מוצגת כהצלחה תפעולית.

## סבב פרופורציה וצפיפות פעיל

לוחות `qa-evidence/digital-observer-reference-refactor-active-231-panel-pairs` נבדקו ידנית פאנל-מול-פאנל. שבעת הרפרנסים נשארים `OPEN`; הבדיקה הטכנית אינה קבלה חזותית.

- במסכי העסק ב-1024 הודקו גריד המצלמות, מסילות הסינון והפעילות, טבלת ההרשאות ורשימת אנשי הקשר כדי למנוע גלישה מעבר ל-first fold.
- במסך התשלום הוקטנו כותרת, רווחים ושורות טופס בקנבס הקצר, בלי להפוך את חיוב המוכנות לחיוב אמיתי.
- בשלב יעדי המצלמה הוחלפה פריסת שורה באריחים חזותיים עם אייקון מרכזי ומחוון בחירה, בהתאם למבנה הרפרנס.
- במסלול הבית הוסרה בחירה מוקדמת של יעדי ניטור; המשתמש מקבל בחירה מפורשת, מחוון ריק או מסומן והערת `ניתן לשנות את ההעדפות בכל עת`.
- בקנבס ההרשמה האנכי הוסרה הכותרת הכפולה, כרטיס הטופס נטמע בקנבס והפעולה הראשית קיבלה רוחב מלא. שדות כתובת ופרטיות שנדרשים למוצר האמיתי נשארו פעילים במסלול העסקי.

`npm run typecheck` ו-`git diff --check` עברו לאחר השינויים. צילום `active-232` לא הושלם: שרת התצוגה המקומי ב-3115 אינו פעיל, וההנחיה הנוכחית אוסרת restart. לכן אין טענת ראיה חדשה או קבלה עבור השינויים האלה עד חזרת preview והרצת side-by-side נוספת.
