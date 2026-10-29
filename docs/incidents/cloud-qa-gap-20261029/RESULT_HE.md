# אבחון פער QA–ענן ובדיקות מדיה ללא שמירת סשן — 29.10.2026

סטטוס: DIAGNOSIS_VERIFIED; CLOUD_PLAYBACK_FAIL; INTERMITTENT_HOME_QA_MEDIA; PUSH 38 NOT DONE.

הפער המרכזי מאומת: Gateway ו־Connector של HOME_QA פונים ל־https://127.0.0.1:3101. כניסת TLS מפנה ליישום QA ב־127.0.0.1:3100. אין במסלול זה יעד ענן. ה־API בענן מציג את אותו מצב offline שהממשק מציג; אין ראיה שהממשק לבדו משמיט שידור חי. שינוי יעד ל־Production או העתקת מצב QA לענן לא בוצעו.

הענן: דרך סשן הפיילוט הקיים נקרא camera-health בקריאה בלבד. 17 מקורות, 11 צפויים, 6 ריקים, 0 בריאים. רשומות DVR נשענות על frame/heartbeat מ־22.09.2026; Tapo על 21.09.2026. שני הרכיבים רשומים ACTIVE אך heartbeat ישן ולכן ההיטל מסמן COMPONENT_OFFLINE/FRAME_STALE. נבדק חזותית מסך הצפייה: רשת ריקה ומנותקות (11). לא נשמרו תמונות מצלמה. שמות/כתובות מדיה ופרטי משתמש לא נכללו בראיות. שיוך Site ומזהי המצלמות תואמים ל־QA; לא הורצה בדיקת זהות Tenant נוספת.

QA: מסד gan-batuach-push38t אומת לפי תווית Docker ונקרא ב־BEGIN READ ONLY/ROLLBACK בלבד. אותם 17 מזהי מקורות, 11 ASSIGNED, שני רישומי רכיב ACTIVE עם heartbeat מהיום. בתהליך 3100 תיקיית המקור היא push38-aws-signing ב־f4fc7ff2d40d93704050114752b4c9007d5f4467; זה זיהוי תיקיית מקור, לא attestation של מודולי Next שכבר נטענו. מודלי health/status בקבצים שם זהים לבסיס העבודה; נתיב dvr-gateway חדש יותר ומוסיף אימות רישום Gateway/Site/פרופיל ו־remote Edge origin. כל 66 בקשות ההרשאה למקורות ב־QA חזרו 200. ניסיון claim אחד בסבב הראשון החזיר 503; יתר ניסיונות claim עברו. אין בכך הוכחת הרשאה בענן.

פריסה: GitHub מתעד Production deployment 6986841337, מצב success מ־10.10.2026, SHA 2da8f75abce610a9a979eecd752d7a6a1011641e וכתובת deployment בלתי משתנה. הקשר הנוכחי בין כתובת זו ל־alias gan-batuach.vercel.app לא אומת עצמאית. Vercel API החזיר 403 בסשן CLI הקיים וגם בקריאה ציבורית; לא רוענן/נוצר token. /api/health בענן חזר 200, Supabase ok, version unknown; /api/development/version חזר 404. SHA הפעיל של ה־alias נשאר UNVERIFIED.

תצורת Edge: Gateway חתום 0.2.101-p38-health, Connector חתום 0.2.40-p38-health; שניהם מציגים ROLLED_BACK אחרי מועמדים שנכשלו. updateDeliveryHold=true נבדק ונשאר ללא שינוי. hash קוד כניסת TLS ותלויותיו תאם להגדרות. בקשת GET ללא הרשאה לכניסה חזרה 401 עם אימות TLS מלא מול ה־CA המקומי הקיים; לא בוטלה בדיקת תעודה.

כלי QA חדש: scripts/qa/probe-homeqa-memory-media.py. התחברות סיסמה רגילה דרך Auth, אימות user, קריאת inventory בהרשאות המשתמש, grant/claim רגילים, פענוח שני frames משני מקטעים בהפרש 8 שניות, בשלושה סבבים, לכל 11 המקורות. שני workers לכל היותר. הסודות נשארים בזיכרון; אין קובץ session, סיסמה, token או מדיה. ffmpeg מקבל bytes דרך stdin ולא URL בשורת פקודה. מגבלת זמן כללית 420 שניות, בקשות 10 שניות ופענוח 8 שניות; logout מקומי ב־finally גם אחרי שגיאה/הפרעה. לא נשלחו RECONNECT_STREAM, restart או פקודות פיזיות. ניסיונות חיבור חוזרים הם grant/reclaim רגילים בלבד.

כשל קדם־בדיקה ראשון נבע מכך ש־Supabase CLI לא השתמש בהקשר Docker שנבדק בפקודת docker הנפרדת. לא נוצר סשן בכשל הזה. הכלי תוקן להצמדת DOCKER_HOST ו־DOCKER_CONTEXT ל־colima-push38t לאחר אימות נתיב socket מדויק; ראיית הכשל נשמרה ולא הוסתרה.

תוצאות:
- first: 175.662 שניות; התחלה 2026-10-29T18:05:09.936262+00:00; מעברים 9/11,10/11,8/11; refresh HTTP 200 באותה זהות; logout=True.
- diagnostic: 181.466 שניות; התחלה 2026-10-29T18:10:49.833775+00:00; מעברים 10/11,10/11,11/11; refresh HTTP 200 באותה זהות; logout=True.

| מקור | מעברים מתוך 6 דגימות | כשל שנצפה |
|---|---|---|
| DVR CH1 | 6/6 | לא נצפה בחלונות הדגימה |
| DVR CH2 | 6/6 | לא נצפה בחלונות הדגימה |
| DVR CH3 | 5/6 | MEDIA_CLAIM_FAILED |
| DVR CH4 | 6/6 | לא נצפה בחלונות הדגימה |
| DVR CH5 | 5/6 | PLAYLIST_NOT_ADVANCING |
| DVR CH6 | 4/6 | PLAYLIST_NOT_ADVANCING |
| DVR CH7 | 5/6 | PLAYLIST_NOT_ADVANCING |
| DVR CH8 | 6/6 | לא נצפה בחלונות הדגימה |
| DVR CH10 | 4/6 | DECODE_FAILED, PLAYLIST_NOT_ADVANCING |
| DVR CH11 | 5/6 | PLAYLIST_NOT_ADVANCING |
| Tapo | 6/6 | לא נצפה בחלונות הדגימה |

בסבב האבחון השני CH6 לא התקדם בשתי דגימות: mediaSequence נשאר 380 ואז 381 בהתאמה, תוכן המקטע נשאר זהה בכל חלון של 8 שניות, ו־ffmpeg פענח 2+2 frames ללא שגיאת פענוח (exit 0). בדגימה השלישית חזר להתקדם ללא התערבות. זו הוכחת קיפאון מדיה זמני, ולא רק החלפת שם מקטע או שגיאת decoder. הסבב האחרון 11/11 אינו מבטל את הכשלים הקודמים. ההרצות הן דגימות HTTP/media חוזרות, לא ניגון דפדפן רציף, ולא 24h soak.

במקביל נמדדו 180.018 שניות של health פסיבי, 7 דגימות. DVR progressing: 2,9,7,8,9,8,9; Tapo: 1 בכל דגימה. הפרשים במוני DVR: 27 starts, שני upstreamEnded/inputSocketError, תשעה warmHandoffs, ארבעה warmHandoffFailures/confirmationFailures, 11 silentResponseRescues, 16 rescue reopens, 12 retries מוצלחים ואפס כשלי retry לפי המונים הזמינים. אלה תהליכי ההתאוששות הקיימים; הבדיקה לא יזמה אותם.

Status derivation: replay של מודלי המקור על צילום מצב QA המצונזר הראה ש־UI live eligibility עם חלון 45 דקות יכול להיות true בזמן שהיטל frame עם TTL של 120 שניות מסמן FRAME_STALE. נתון lastFrame מפנה ל־last_seen_at כשאין timestamp פריים מפורש. זו מגבלת פרשנות ועדות לפער חוזים; replay אינו תגובת ה־API המקומי ואינו מוכיח שמידע discovery הוא פענוח. לא הורחבו TTL ולא נכתבו timestamps מלאכותיים כדי לייצר PASS.

משאבים: נמדדו כ־310MB פנויים בכונן HOME מול כ־1.67TB פנויים בכונן הפרויקט, ועומס ממוצע 9.03/14.51/18.25. תיקיות HLS הזמניות הסתכמו בכ־46.7MB. בחלון לוג היסטורי מוגבל נראו גם סימני timeout/No space left, אך הוא אינו תחום לזמני ההרצה. לחץ כונן הוא גורם אפשרי; לא הוכח שגרם לתקיעות הנוכחיות. לא בוצעה מחיקת קבצים, הזזה או נגיעה בגיבויים.

Root cause מוכח לפער התצוגה: יעדי backend שונים, עם מצב מקורות ישן בענן וטלמטריה פעילה ב־QA. סיבת השורש הפנימית של קיפאון DVR עדיין פתוחה; הממצאים מצביעים על רציפות upstream/handoff ולא על כשל גורף בהרשאת הפיילוט. auth refresh רגיל עבר בשתי ההרצות. אין הוכחה לחידוש הרשאת מכשיר Edge, lease ממושך, ניגון רציף או צפייה מרחוק.

בדיקות: 5/5 unit tests לכלי עברו, לרבות דחיית יעד/נתיב מדיה שגוי, חסימת רשת אחרי budget, יציאה אחרי refresh תקין/נכשל והפרעה, והיעדר credentials בקבצים ובפלט. בדיקות גבולות URL כוללות שישה תרחישי דחייה ודוגמה תקינה. תוצאות מדיה live נשמרו בנפרד; כשל קבלה אינו מסומן PASS. לא שונה קוד המוצר ולא בוצע build/CI release.

Rollback וניקוי: שני הסשנים שנוצרו יצאו ב־logout מקומי מוצלח. לא נוצר שרת viewer חדש ולא נשמר token. תצפית health הסתיימה מעצמה. אין שינוי runtime/תצורה, DB/schema/ACL, main, Production, OTA hold, ספק/תשלום או פקודה פיזית. סשן הבעלים בענן נשאר. כלי ה־QA וקובצי הראיות הם השינויים היחידים. שימור מרוחק/ledger/integration עדיין ממתינים במפורש; אין טענת release readiness.

המשך ושערים: (1) אימות alias deployment SHA דורש סשן Vercel קריא תקף; 403 נותר חסם ולא נעקף. (2) החזרת מצב בענן דורשת החלטת יעד והרשאה נפרדת לשינוי Production, אחרי מועמד קונקרטי ושערי השחרור; אין להפנות מכשירי HOME_QA ל־Production כפתרון מהיר. (3) לתיקון רציפות יש להכין מועמד QA ממוקד מנתוני המקור, לבדוק סינתטית ולהעבירו במסלול החתימה/rollback הקיים; לא לשחרר את OTA hold או לשנות slot חתום ידנית. (4) צריך לשחזר מרווח כונן בטוח לפני build/הפעלה נוספת כבדה; ניקוי אישי או גיבויים מחוץ לתחום יחידה זו. PUSH38 נשאר NOT DONE.
