# בדיקת מסך ענן ויציבות פסיבית — 29.10.2026

תוצאה: CLOUD_PLAYBACK_FAIL; HOME_QA_PASSIVE_SOAK_FAIL; PUSH 38 NOT DONE.

הבדיקה השתמשה בסשן הפיילוט הקיים בענן בקריאה בלבד. רשימת הצפייה החיה הראתה אפס פעילות ו־11 מנותקות: DVR 1–8,10,11 ו־IP/Tapo. בפירוט ערוץ 1 אין אלמנט video; מוצגים ״ה-DVR לא החזיר וידאו בערוץ זה״ ובדיקה אחרונה 22.09.2026 11:13. Site תאם לראיות הקודמות; בידוד Tenant וזהות backend לא נבדקו מחדש. לא נשלחו בקשות grant/claim או פקודות מצלמה בענן.

התצפית המקומית: 180.020 שניות, שבע דגימות במרווחי 30 שניות, 14 קריאות health בשני פורטי loopback בלבד. התחלה UTC: 2026-10-29T16:04:52.381664+00:00 (ישראל UTC+2). לא נוצרו סשנים ולא נקראו או נשמרו credentials/tokens. כרטיסיית QA המקומית שייכת לצ׳אט המקורי ולא נלקחה ממנו. לכן אין מדידת decoded frames חדשה, אין הוכחת auth renewal של משתמש ואין PASS לנגן או ל־24 שעות. מדדי chunks הם קלט relay ועשויים להתאפס בהחלפת relay; Tapo דיווח chunks=0 ולכן אין לפרש זאת כספירת תמונות.

| מקור | progressing | דגימות תקועות | תוצאה פסיבית |
|---|---|---|---|
| DVR CH1 | 6/7 | 1 | FAIL_OBSERVED_STALL |
| DVR CH2 | 7/7 | 0 | PASSIVE_PROGRESS_ONLY |
| DVR CH3 | 6/7 | 1 | FAIL_OBSERVED_STALL |
| DVR CH4 | 5/7 | 2 | FAIL_OBSERVED_STALL |
| DVR CH5 | 6/7 | 1 | FAIL_OBSERVED_STALL |
| DVR CH6 | 5/7 | 2 | FAIL_OBSERVED_STALL |
| DVR CH7 | 7/7 | 0 | PASSIVE_PROGRESS_ONLY |
| DVR CH8 | 5/7 | 2 | FAIL_OBSERVED_STALL |
| DVR CH10 | 6/7 | 1 | FAIL_OBSERVED_STALL |
| DVR CH11 | 7/7 | 0 | PASSIVE_PROGRESS_ONLY |
| Tapo | 7/7 | 0 | PASSIVE_PROGRESS_ONLY |

ב־DVR מספר המקורות המתקדמים היה 10,10,7,6,10,9,8. נרשמו 17 starts, ארבעה upstreamEnded ו־inputSocketError, שבעה warmHandoffs ושני warmHandoffFailures/confirmationFailures, 11 post-release retries שדווחו כמוצלחים ושמונה silentResponseRescues. אלה מונים של מנגנוני התאוששות קיימים, לא פעולות שהבדיקה יזמה, ולא מספר מדויק של ניתוקי משתמש. לאחר הדגימה הגרועה נצפתה חזרה ל־10 progressing, אך הסיום היה 8. זמן output_idle הגיע לכ־60.7 שניות בערוץ 8. Tapo דיווח progressing בכל שבע הדגימות וללא שינוי במוני relay שנבדקו; אין בכך הוכחת תמונות בדפדפן.

Auth: GET מקומי ללא credential ועם ערך INVALID נענו 401 (2/2). שני deviceAuthorization status=ready. אין rotation או proactive renewal במדדי DVR בחלון; אין להסיק מכך שחידוש הרשאה עבר. שתי login_attempts נוספו במונה recorder ב־Tapo, ללא הצלחה; סוג המקור שונה, ולא אומתה משמעות מונה זה עבור RTSP. בדיקות TLS בענן מוגבלות לטעינת HTTPS רגילה בדפדפן, ללא בדיקת שרשרת/חידוש תעודה.

Root cause: כשל רציפות DVR נתמך במדדי socket/handoff/rescue ובתקיעות המקורות; סיבת השורש של upstream אינה מוכחת. מסך הענן מציג מצב offline ישן ואינו תואם למדדי QA המקומיים; אלו סביבות שונות ולכן אין לייחס זאת לתקלה מוכחת בסנכרון אותו backend. לא נבדק backend ענן ישירות ולא אומת SHA הפריסה. נדרש אבחון ממוקד של נתיב health/telemetry והיעד המורשה לפני תיקון. עצירה בשער Production: אין שינוי כדי לנסות להחזיר את המסך.

בסיס הראיות d54eaf8548f1e26a799ca14592381b4f875426c4 נבדק מחדש: manifest מכיל בפועל 21 רשומות וכולן עברו SHA256, לרבות קובץ בדיקות boundary; המספר 20 שנמסר קודם אינו ספירת ה־manifest הנוכחי. 6/6 ו־4/4 הן בדיקות היסטוריות שהראיות שלהן נקראו, לא בדיקות live חדשות. ה־checkout המבודד התחיל ב־2da8f75abce610a9a979eecd752d7a6a1011641e; לא מוזג אליו הקוד של ענף ה־QA.

Rollback וניקוי: התצפית הסתיימה מעצמה; אין שרת/viewer או סשן חדש. סשן הבעלים בענן נשאר קיים. לא שונו שירותים, Auth, DB, schema, ACL, main, Production או OTA; לא הופעל ספק/תשלום ולא בוצעו פעולות פיזיות. מסלול הגיבוי נשאר ללא נגיעה. rollback אינו נדרש למצב הריצה; מחיקת ראיות אינה חלק מהעבודה. השינוי כולל ראיות וכלי תצפית בלבד, מקומי, ללא push/ledger/integration; שימור מרוחק ממתין במפורש.

מסירה: ניסיון send_message_to_thread אל ״אפיון מערכת תצפיתן 3״ נדחה בבקרת האישור האוטומטית. הסיבה: ההוראה המואצלת אינה אישור אנושי מפורש להודעה ביעד. הסיכום לא נמסר; לא בוצע ניסיון עקיפה. נדרש אישור משתמש ישיר למסירת הסיכום לצ׳אט 01a17446-bdbb-76d1-971d-1d3b23e1565d.
