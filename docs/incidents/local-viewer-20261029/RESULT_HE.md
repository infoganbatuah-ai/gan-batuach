# HOME_QA viewer preflight — 29.10.2026

מקור: chat `01a185d7-52b0-7e72-b066-6d0aa0b4a92c`, turn `01a1871b-d3c7-7501-a4a8-a1f39a0340a7`. ענף `codex/stream-recovery-diagnostics-20261029`, בסיס `9e9e6c4c05590761849b997958d44c27e807170c`.

**הצפייה בנגן לא אומתה; לא נוצר token או סשן חדש.** אושרה בדיקה מוגבלת של HOME_QA לקריאה בלבד וסשן צפייה ל־20 דקות, ללא שינוי נתונים/Production/סודות. קראנו מחדש AGENTS קנוני והפעלנו את הנחיות skill Supabase. לא בוצע שינוי בקוד המוצר, בסכמה, בזהויות, בשיוכים, בשירותים או בנתוני DB.

## תוצאה עצמאית

`preflight.json` הוא פלט allow-list של בדיקה אמיתית: Docker context ייעודי עם endpoint מקומי מסוג unix; DB container עם project label הנכון; HTTP loopback של QA ושל Auth החזירו 200. מתאם REST המקומי החזיר 404 לשורש, שאינו מסלול משאב ולכן אינו הוכחת כשל REST.

שאילתת psql הופעלה באמצעות `docker --context colima-push38t exec -e 'PGOPTIONS=-c default_transaction_read_only=on' supabase_db_gan-batuach-push38t psql -X -A -t -U postgres -d postgres -c <bounded SELECT>`. זהות המשתמש נלקחה מקובץ QA פרטי קיים, אומתה כ־UUID ושולבה בשאילתה. החזרנו לדוח רק booleans/counts: המשתמש קיים ואינו חסום; **אפס סשני Auth פעילים**; inventory כולל 17 slots, מהם 11 assigned ו־11 connected. ששת ה־slots הריקים אינם מצלמות חסרות. לא נחשפו מזהי משתמש/סשן, דוא״ל, סיסמה או app metadata בדוח או בפלט לצ׳אט. לא הופעלה התחברות או כתיבת SQL.

הוכחת הפענוח של 11 מקורות מהתור הקודם נשארת ראיה היסטורית בלבד (`b4e995b3`, `9e9e6c4c`); לא הורצה מחדש בתור זה ולא הוצגה כנגן מחובר.

## שער שנדחה

ניסיון מתוכנן להנפיק ב־memory JWT קצר באמצעות מפתח החתימה המקומי ולבדוק הרשאת מקור נדחה **לפני הרצת הפקודה** ב־automatic approval review. הנימוק: הוצאת JWT signing secret והנפקת authenticated token ללא Auth session פעיל עוקפות את בקרת הסשן. לא הורצה הפקודה, לא נקרא מפתח החתימה, לא נוצר token ולא נשלחה בקשת authorization. לא הוחלפה דרך הכלי או הוסרה בקרת הסשן כדי לעקוף את הדחייה.

אין להפוך את סקריפט ההנפקה ההיסטורי של phone-session למנגנון עקיפה של בקרת סשן חדשה. הפעולה התקינה שנותרה היא התחברות רגילה באמצעות פרטי החשבון הקיימים, ללא יצירת משתמש או החלפת סיסמה.

## אי־התאמה קונקרטית להרשאת read-only

- חוזה המקור הנוכחי `lib/domain/digital-observer/access.ts` דורש `digital_observer_current_session_active()` נוסף על getUser. המימוש במיגרציה `20261023161928_digital_observer_push44_session_validity.sql` מחפש session_id פעיל של אותו user ב־auth.sessions. לא הופעלה המיגרציה ולא נטען שהגרסה הפרוסה של QA זהה לקוד זה.
- התחברות תקינה יוצרת רשומת Auth session ונתוני audit של Auth; אין סשן קיים לשימוש חוזר לפי ה־SELECT שבוצע.
- `app/api/video-gateway/playback-grant/route.ts` רושם `gateway_playback_grant_redeemed` ב־provider_webhook_events כבדיקת replay. זהו רישום אבטחה נדרש, לא פעולה שיש להשמיט לצורך נגן. מימוש grant רגיל אינו read-only בקוד הנוכחי. לא בוצעה בקשת claim למכשיר, ולכן לא נכתב audit כתוצאה מהבדיקה שלנו ולא נפתח חיבור מצלמה.

נשאלה שאלת בעלים ממוקדת: לאשר Auth session וכתיבת רשומות אבטחת צפייה בלבד ב־HOME_QA, ללא שינוי נתוני מוצר/זהויות/שיוכים/Production, עם ניתוק בסיום. לא נדרשת סיסמה בצ׳אט, מפתח age, תשלום או פעולה פיזית. לא מתייחסים לחלוף זמן כאישור.

## UI, בדיקות וניקוי

ניסיון לפתוח מסך login מקומי בלבד באמצעות כלי הדפדפן הסתיים ב־timeout. לא הוקלדו פרטי התחברות ולא התקבלה הוכחת נגן/וידאו. אם נותרה לשונית זמנית, היא כפופה לניקוי כלי הדפדפן; לא סומן deliverable או handoff של סשן מחובר.

CLI Supabase לא שימש לביצוע שאילתה: פקודות version/help נכשלו עקב ניסיון כתיבת telemetry בסנדבוקס. עברנו ל־psql במכולת QA המבודדת עם read-only enforced. לא הופעל start/reset/repair, לא הותקנה תלות ולא נקרא Docker context אחר. לא הורצו בדיקות מוצר או CI על מועמד חדש, כי לא שונה מוצר. JSON receipts ו־diff נבדקו; אין PASS של auth/playback מכוח תיעוד זה.

סקריפט ה־preflight הזמני הוסר בסיום. פקודת token שנדחתה לא יצרה קובץ סודות; אין token שיש לבטל או להמתין לפקיעתו. לא בוצע logout למשתמש הפיילוט בענן, ולא נגעו בסשן המשתמש הקיים.

## המשך מדויק לאחר ההרשאה הנדרשת

1. התחברות Auth רגילה לחשבון HOME_QA הקיים דרך הזרימה הנתמכת, ללא מפתח חתימה או JWT ידני; ביטול/ניתוק הסשן בתום חלון בדיקה של עד 20 דקות.
2. אימות משתמש/site/source/enrollment ו־deny לאתר/מקור שגויים, ללא שינוי הנתונים או השיוכים.
3. הנפקת grant דרך API המוצר ומימושו דרך ה־Gateway/Connector הרגילים, תוך שימור רישום אבטחה ו־replay protection. אין לחשוף מקור פיזי או לעקוף TLS/CORS כדי להציג תמונה.
4. אם כתובת המדיה שמוחזרת אינה נתיב QA מקומי מאושר, לעצור את אותו מסלול ולהכין שינוי קונפיגורציה נפרד לבדיקה; הרשאה זו אינה פותחת ingress ציבורי או מתקינה שרת חלופי עם סמכות עוקפת.
5. אימות בפועל בנגן: dimensions, frame/time advancement וגבולות ההרשאה ל־DVR ול־Tapo בנפרד, לאחר מכן ניקוי סשן. לא לקדם PUSH38 ל־DONE מכוח smoke בלבד.

שימור: evidence-only מקומי בענף מבודד, remote/integration pending; אין main/Production. מסירה לצ׳אט האפיון מיועדת לסיכום מצונזר ומזהי ראיות בלבד, בלי פירוט runtime או סודות שנחסם קודם.
