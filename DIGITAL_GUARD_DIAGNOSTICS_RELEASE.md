# חבילת אבחון מצלמות — הכנה, לא שחרור

מצב: קוד ואימות מקומי ראשוני הושלמו; אין אישור Production ואין טענה ל-E2E חי.

עדכון 2026-09-01, 00:42: לאחר סקירת תיקון ה-fixture ו-GO חדש, כל preconditions עברו: migration SHA `f91ca4f…`, test SHA `656fc2d8…`, hashes של שבעת מקורות stage וקיום PGlite/driver. הריצה מתוך workdir של `Fi8MSf` עברה **3/3**, exit 0, זמן קיר 3.78 שניות. אומתו Guard enqueue→Gateway poll→preflight→scoped status עם אודיט יחיד וללא ACK פיזי; שני כותבים לאותו ID יוצרים intent/job יחיד; ומתאם preflight האמיתי ממפה snapshot capabilities באמצעות probe סינתטי בלי לאפשר פקודות. אין stage/product שינוי, live DB, רשת, מצלמות, build או DDL.

ראיית fixture מדויקת: השינוי קיים רק ב-`scripts/qa/digital-guard-diagnostics-postgres.test.mjs` החיצוני, SHA-256 `656fc2d8d94b4754c1f0a2d155da50a10281b32d3ececb7d5ee8f1d1c7778e1f`; הוא אינו חלק ממלאי המקור של `Fi8MSf`. אין טענת deploy בעדכונים אלה.

עדכון 2026-09-01, 00:38: preconditions לשלוש בדיקות PostgreSQL עברו (SHA המיגרציה, test/modules ו-hashes של שבעת מקורות stage). הריצה עצמה הסתיימה exit 1 בזמן 3.06 שניות: 3/3 נכשלו `DIAGNOSTIC_FORBIDDEN` לפני כתיבת תור. האבחון מצא פער fixture: `Fi8MSf/access.ts` בוחר גם `camera_limit`, `monitoring_hours`, `event_retention_days`, `ai_features`, אך טבלת `observer_sites` המבודדת לא יצרה אותן; כשל SELECT הפך ל-site חסר ונחסם כראוי. תוקן רק DDL ה-fixture החיצוני בארבע העמודות, SHA חדש `656fc2d8…`; לא שונו stage, assertions או הרשאות ואין rerun ללא GO חדש.

עדכון 2026-09-01, 00:35: בעל התור יצר config זמני מחוץ לחבילה, שיורש את tsconfig של stage אך משתמש ב-`include: []`, רשימת `files` מפורשת ו-`next-env.d.ts`. core עבר ב-512MiB; כל שבעת קובצי diagnostics עברו ב-768MiB; לאחר הוספת `app/digital-observer/cameras/page.tsx` ה-targeted TypeScript עבר ב-1024MiB, exit 0. שגיאת TS2882 הראשונית עבור `server-only` נפתרה על ידי הכללת `next-env.d.ts`, ללא declaration מלאכותי. חבילת `Fi8MSf` לא השתנתה. מסקנה: **delta + integration page targeted TypeScript PASS**; full-project TypeScript נשאר OOM/NOT PASS.

עדכון 2026-09-01, 00:31: ניסיון הקיבולת האחרון שאושר, עם alarm של 120 שניות ו-V8 old heap של 1536MiB, נעצר גם הוא ב-heap OOM סביב 1526MiB: exit 134, זמן קיר 23.30 שניות ו-0 diagnostics. זהו NOT PASS וללא timeout. בהתאם לאישור לא תבוצע העלאת heap או ריצה נוספת אוטומטית. שער TypeScript דורש כעת אבחון אסטרטגיה/חלוקת פרויקט במקום הגדלת זיכרון עיוורת. אין תהליך שנותר והחבילה לא השתנתה.

עדכון 2026-09-01, 00:29: לאחר שהעומס ירד ונבדק זיכרון פנוי אושר ניסיון מתוקן יחיד עם alarm של 90 שניות ו-V8 old heap של 768MiB. גם הוא נעצר ב-heap OOM סביב 761MiB: exit 134, זמן קיר 7.31 שניות ו-0 diagnostics. זהו **NOT PASS** נוסף, ללא timeout וללא ראיית שגיאת טיפוסים. בהתאם לשער לא בוצעו retry, הגדלת heap נוספת, fallback, PG, build, DB, רשת או מצלמות; אין תהליך שנותר והחבילה לא השתנתה.

עדכון 2026-09-01, 00:27: לאחר שאובחנה מגבלת שינוי העדיפות התקבל GO מפורש לניסיון TypeScript יחיד ללא priority, עם alarm של 60 שניות ו-V8 old heap של 512MiB. Node התחיל אך נעצר ב-heap OOM (Mark-Compact סביב 508MiB), exit 134, זמן קיר 4.24 שניות, לפני דיווח diagnostics של TypeScript. התוצאה היא **NOT PASS**: 0 diagnostics אינם הוכחה שאין שגיאות. לא בוצעו retry, הגדלת heap, fallback, PG, build, DB, רשת או מצלמות; אין תהליך שנותר והחבילה לא השתנתה.

עדכון 2026-09-01, 00:25: התקבל GO לריצת TypeScript יחידה עם תנאי fail-closed. תנאי `priority >= 10` נכשל (`priority_precondition_failed`) ולכן Node ו-TypeScript **לא התחילו**. התוצאה: exit 1, זמן קיר 0.02 שניות, 0 diagnostics ו-peak RSS לא זמין. זהו BLOCKED תפעולי, לא כשל TypeScript ולא PASS. לא בוצעו fallback, escalation, retry, DB, רשת, מצלמות או build; החבילה לא השתנתה.

עדכון 2026-09-01, 00:20: בעל התור דיווח שהמיגרציה המאושרת בעלת SHA `f91ca4f57f35d3796f0e7293d01efa759c9fc268b544e231c3ae633f7cafe64d` הוחלה ב-Production לאחר rollback מלא מה-deadlock וניסיון מתואם יחיד. בבדיקת post-apply שלו אומתו שבע העמודות, האילוצים, מדיניות RLS מצומצמת וה-projection דרך PostgREST. זו ראיית מבנה מסד שדווחה מהמשימה המורשית; אין כאן פריסת קוד, בדיקת UI, שימוש בחומרה או אימות E2E. שער SQL נסגר; שערי TypeScript, פריסה ואימות חי נשארים פתוחים.

עדכון 2026-08-31, 23:20: בריצה חד־פעמית מתואמת מתוך החבילה המדויקת עברו **26/26** בדיקות integration/client, קוד 0, זמן קיר **10.69 שניות**. הבדיקות כוללות את פיצול הסכמה וחיזוק התאמת request ID/זמני אודיט. המקורות בחבילה לא שונו. הריצה הוגבלה בתהליך בדיקה יחיד ול-60 שניות; **הורדת העדיפות נדחתה** (`setpriority: Operation not permitted`) אך `nice` המשיך להפעיל את הבדיקה. בקשת עצירה בוצעה אחרי ההודעה, ובאותו שלב התהליך כבר הסתיים בהצלחה. אין ראיה לעדיפות נמוכה, אין retry ואין תהליך בדיקה שנותר. ריצה עתידית חייבת לעצור לפני הרצת הבדיקות אם שינוי העדיפות נכשל; אין להסתמך על `nice` לבדו. בדיקת הטיפוסים המלאה, PG אחרי הדלתא האחרונה, פריסה ו-E2E חי עדיין לא הושלמו.

מעקב 2026-08-31, 22:14: כל 1191 קובצי החבילה נבדקו שוב מול המלאי ונמצאו ללא שינוי; ה-hash הקנוני תואם. בעל התור אישר שהמיגרציה עדיין לא הוחלה. העומס המקומי עדיין חריג (load average מעל 340), ולכן לא נפתחה בנייה נוספת ולא חזרנו על לחיצות דפדפן שנכשלו לפני שיגור. זהו אימות שלמות מקור בלבד, לא בדיקת הרצה ולא התקדמות בפריסה.

## בסיס מדויק

- חבילה: `/private/tmp/guard-diagnostics-release.Fi8MSf`.
- מלאי: `/private/tmp/guard-diagnostics-release.Fi8MSf.inventory.json` — 1191 קובצי מקור.
- SHA-256 קנוני של מלאי המקורות: `d3aff57d6a1068b1b9c5592508c764114bfc00845d15015cb4125777b67ee9e1`.
- בסיס פרוס: `dpl_8DeajRc6Y7RojyVwLUK5xhQu48bZ`, מלאי 1181 קבצים בעל hash `668ebaa20391975d098ee09574cced7466673d3a586a0276d9659a030c91f5d9`.
- מעליו overlay תור מתוך `/private/tmp/camera-queue-release.TMWpRw`, שאינו פרוס עדיין בעת כתיבת המסמך.
- אין העתקת סודות, סביבות, session, מסד מקומי, מידע מהבית או קובצי Gateway פרטיים. node_modules הוא קישור מקומי לצורך בדיקות ואינו מקור מוצר.

## דלתת המוצר

שבעה קובצי קוד חדשים: `camera-diagnostics/route.ts`, `guard-diagnostics-panel.tsx`, `camera-action-schema.ts`, `guard-engine.ts`, `guard-diagnostics-types.ts`, `guard-diagnostics-service.ts`, `guard-diagnostics-client.ts`.

`guard-engine.ts` אינו קיים בבסיס הפרוס ולכן נוסף, לא דורס מנוע פרוס. תלויות runtime שלו מוגבלות לחוזה סוגי האירועים הקיים; אין בו I/O לספק או חומרה.

נוספו שתי בדיקות: `digital-guard-diagnostics-integration.test.mjs`, `digital-guard-diagnostics-client.test.mjs`.

במסך `app/digital-observer/cameras/page.tsx` שבחבילה נוספו רק import ורכיב למקור שאינו דמו, עם key לפי אתר ומצלמה. יתר המסך, נגן הווידאו, טיפול במקורות מנותקים, הרשאות והסגנון נשמרו מהבסיס. אין העתקת הדף הרחב מה-worktree.

קובצי התור מה-overlay הקודם:

| קובץ | SHA-256 |
|---|---|
| `app/api/video-gateway/camera-actions/route.ts` | `ce5535580b6cf58337ebd54fe75df8ae8c2aaf880fcdb2d3820f35099a4a5a69` |
| `lib/domain/digital-observer/camera-queue-contract.ts` | `e862a7b7e025cd8f9ca453a35900f4416f3d3c0b048ebbba2fcd0c1ebd235765` |

## מה אומת ומה עדיין לא

- 26 בדיקות שירות/HTTP/לקוח/רכיב עברו גם מתוך החבילה אחרי פיצול הסכמה וחיזוק בדיקת request ID/זמני אודיט; ראו הריצה המדויקת בעדכון העליון.
- שלוש בדיקות PostgreSQL עברו גם אחרי הדלתה האחרונה ותיקון ה-fixture: טריגרי אודיט מקוריים, שני כותבים ומתאם preflight אמיתי עם probe סינתטי; ראו עדכון 00:42.
- 65 רגרסיות ושלוש חבילות בדיקת אירועים עברו בנפרד. אין לסכם אותן עם הריצות ההיסטוריות הכוללות חפיפה.
- סקירת בעל התור לא מצאה ממצא חוסם בקוד או בדלתת הדף. זו אינה חלופה לבדיקה הסופית של החבילה.
- TypeScript מלא, PostgreSQL אחרי הדלתא האחרונה ובדיקת מסך חי **טרם הושלמו**. החרגה חד־פעמית הותרה רק ל-26 בדיקות החבילה שהסתיימו; ההקפאה על בדיקות כבדות נמשכת עקב עומס מקומי חריג.

## שערי שחרור — כולם נדרשים

1. החלת SQL מאושר ואימות מבנה התור בענן בידי בעל משימת היכולות. אין ניסיון החלה מקביל ממשימה זו.
2. בדיקות האינטגרציה/הלקוח מתוך החבילה עברו. נותרו TypeScript מלא ובדיקת רגרסיה לפיצול הסכמה המשותפת גם ב-worktree לאחר ירידת העומס ובתיאום; אין פתיחת ריצות נוספות באופן אוטומטי.
3. וידוא שכל hashes תואמים למלאי, ושבסיס הפריסה לא התחלף מאז; אם השתנה — להכין חבילה חדשה מעליו, לא לדרוס.
4. פריסה מתואמת ובדיקת הרשאות ללא session. אין שימוש במפתח עקיפת הגנת Preview.
5. בחשבון הבית בלבד: בדיקת המסך והבקשה דרך ההתחברות הרגילה, אימות audit ותשובת Gateway בסקופ המדויק ובתוך TTL. אין דמו/fixture ואין פתיחת גריד/שידורים במקביל לבדיקת הכיסוי של בעל ה-Gateway.
6. שום תוצאת preflight אינה פותחת פעולה פיזית. אין סירנה, תאורה, תנועה, דיבור או חיוג חירום בחבילת האבחון הזאת.

יומן הגן וספקי פנים/LPR/Pose/אש/בריכה אינם חלק מחבילה זו ונשארים משימות נפרדות. אין טענת תאימות רגולטורית או אמינות בטיחותית על סמך בדיקות החיבור.
