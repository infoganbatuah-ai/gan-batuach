# אירוע שידורי הפיילוט — 29.10.2026

מסמך זה משמר את חלון האבחון הראשוני לפני ההחלה. לאחר אישור הבעלים בוצע שחזור QA המתועד ב־[RECOVERY_RESULT_HE.md](RECOVERY_RESULT_HE.md). אין לפרש את סטטוס התעודה או הרשאת QA ההיסטוריים להלן כמצב לאחר התיקון; ראיות האבחון המקוריות נשמרות ללא דריסה.

מצב: **אבחון הושלם עד גבול ההרשאה; השידורים במוצר לא שוחזרו.** אין PASS חי, אין שינוי main/Production, ואין קידום PUSH 38 ל־DONE מכוח אירוע זה. זהו מסלול incident מקביל שאינו מבטל את משימת המצלמות הראשית.

## מסקנה

יש שלושה חסמים נפרדים הנתמכים בראיות:

1. **HOME_QA מנותק ממישור הבקרה עקב תעודת TLS שפגה.** שני הרכיבים משתמשים בזהות QA המכוונת ל־`https://127.0.0.1:3101`. אימות HTTPS מלא נכשל עם `certificate has expired`; תעודת האמון הוגבלה מ־17.10 22:01:12 UTC עד 24.10 22:01:12 UTC. שירות ה־QA מאחוריה עונה HTTP 200 עם `supabase: ok`. זהו חסם מאומת, ללא צורך בסיסמה או בפקודת מצלמה. פקיעת התעודה מסבירה את הכשל הנוכחי ב־QA; היא אינה יכולה להסביר את כל הפער בענן שהחל בספטמבר.
2. **התקנת HOME_QA ומוצר הענן נמצאים במסלולי זהות שונים.** רשומות הענן של הפיילוט נשארו LEGACY_HMAC עם last_seen מספטמבר, בעוד ההתקנה המקומית משתמשת ב־HOME_QA loopback. המוצר המחובר מציג אפס מצלמות חיות ו־11 Offline. אין להחליף כתובת או להעתיק זהויות QA/Production כקיצור דרך. שחזור הרשאת QA לבדו אינו מוכיח שהמוצר בענן יקבל heartbeat או וידאו.
3. **כשל מדיה עצמאי ב־DVR, על גרסה שחזרה לאחור.** Gateway רץ על 0.2.101; OTA מתעד rollback של 0.2.102 עקב `EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP`. ב־checkpoint הראשון נצפו 0/10 מתקדמים; בשלוש דגימות נוספות נצפו 8/10, 8/10, 7/10 מתקדמים (זמינות מדיה אפקטיבית בדגימה השלישית 9/10 בגלל renewal). heartbeat מול המקליט הצליח, ללא כישלונות רצופים או דחיית אימות בזמן הדגימות. לא הוכח אם מקור כל stall הוא המקליט, LAN, transcoder או לוגיקת relay. אין לכנות זאת תקלה פיזית ודאית במצלמות.

ב־Tapo נצפה 1/1 מקומי מתקדם בכל שלוש הדגימות, עם הרשאת ענן unavailable. זה שולל טענה שכל 11 המצלמות עצמן היו ללא זרם באותן דגימות. אין זו הוכחת Product playback, איכות וידאו, פענוח חזותי, Event או AI רציפים.

## בסיס ראיות וגבולות

- נקודת בסיס מקור מקומית: `2da8f75a` (main snapshot, לא אימות SHA הפריסה). מזהי המקורות המלאים וה־Git blobs: `canonical-sources.json`.
- קראתי את AGENTS.md שבשורש הקנוני, וכן את גרסת Git. הנחיות השורש המקומי כוללות הרשאה לעבודה אוטונומית שגרתית אך משמרות מגבלות הפעלה, זהות, עלות ו־Production.
- נבדקו PUSH38 S/T/U, root-cause register ההיסטורי, trust-first handoff, ובעדיפות גבוהה יותר דוח qualification וראיות closure מאוקטובר. ההנדאופים המוקדמים אינם מצב נוכחי.
- ראיות מקומיות מסוננות לפי allow-list: `live-evidence.json` — שלוש דגימות לאורך כ־20 שניות, גרסאות/build SHA, ערוצים, התקדמות, auth, TLS ו־rollback. זו אינה בדיקת soak.
- בדיקות Supabase בענן היו SELECT מוגבל לאתר הפיילוט, metadata של סכמה, advisors ולוגים מצרפיים. לא נשלפו סיסמאות, hashes של credentials, private keys, כתובות מגורים או מדיה. הסיכום המצונזר: `backend-evidence.json`.
- סשן המשתמש הקיים בדפדפן אישר UI חי של 11 מקורות Offline ואפס מקורות עם וידאו. לא נעשה שימוש בסיסמה שנמסרה בשיחה אחרת; לא נקראה רשומת מנהל הסיסמאות.
- לא נשלחה בקשת refresh/authenticate יזומה למכשירים: זו עלולה לסובב credentials או לכתוב nonce/sequence. לא נפתח session DVR נוסף.

## ציר זמן

| זמן | עובדה | משמעות |
|---|---|---|
| 13–19.09 | דוחות 38J/N/S/T: כשלים ידועים ב־DVR/Tapo/health, gates של trust/delivery/ingress ו־QA | אין לייחס outage חדש למצלמה בלי ראיה; הראיות המוקדמות אינן הוכחת תיקון |
| 21.09 02:46 UTC | last_seen אחרון ברשומת Connector בענן | הרשומה פעילה ולא revoked, אך אינה טרייה |
| 22.09 08:13 UTC | last_seen אחרון ברשומת Gateway בענן | תואם פער עדכוני UI; אינו מועד תחילת כל תקלה מקומית |
| 23.09 ואילך | handoff מתעד זהויות ED25519 במסלול HOME_QA ותהליכי OTA | אין שקילות אוטומטית לרשומות LEGACY_HMAC בענן |
| 18.10 | PUSH38 נסגר לפיתוח בחריגת קבלה מפורשת: 102/41, Canary PASS, שלוש שעות strict NOT_DONE | אין PASS רציף 24 שעות. 0.2.101 V8 נשאר NOT_DONE עם ראיות sealed |
| 20.10 11:34 UTC | Connector מתועד ROLLED_BACK מ־41 ל־40 | התקנה נוכחית שונה ממצב הסגירה |
| 24.10 14:21 UTC | Gateway מתועד ROLLED_BACK מ־102 ל־101, signed known-good stability reverified | אין להסיק ש־102 פועל היום |
| 24.10 22:01 UTC | תעודת QA פגה (25.10 01:01 בשעון ישראל) | TLS validation מונע גישה מהימנה למישור הבקרה |
| 29.10 | UI ללא וידאו; תהליכים ו־tunnel חיים; Tapo מקומי מתקדם; DVR לא יציב; QA TLS נכשל | outage משולב של חיבור למוצר ושל מדיה, ללא שחזור מאומת |

## הפרדה בין שכבות

| שכבה | תוצאה | הוכחה / אי־ודאות |
|---|---|---|
| DVR | PARTIAL / DEGRADED | discovery: 16 slots, 10 assigned, 6 unassigned; recorder heartbeat תקין; media progression לא רציף |
| Tapo/IP | LOCAL PROGRESSION VERIFIED | 1/1 בשלוש דגימות. אין הוכחה לצפייה חיצונית או פעולת AI מלאה |
| תהליך Gateway/Connector | ALIVE | health/liveness HTTP 200; גרסאות מותקנות תואמות current metadata; ארכיונים חתומים לא אומתו מחדש במלואם |
| שירות QA | UPSTREAM REACHABLE, TLS BLOCKED | 3100 health 200 / Supabase ok; 3101 TLS expiry. לא בוצעה עקיפת TLS |
| Cloudflare | CONNECTED, MEDIA ROUTE NOT PROVEN | readiness HTTP 200, ארבעה חיבורים; config מקומי עם catch-all 404 וללא host/service ingress למצלמות. לא נבדקה תצורת חשבון מרוחקת; tunnel חי אינו הוכחת נתיב וידאו |
| Relay/stream path | DVR DEGRADED / TAPO PROGRESSING | counters + per-channel health; לא הופעל playback כדי להימנע מ־grant/session/relay side effects |
| Tenant/Site authorization | PARTIAL | אתר פעיל ו־monitoring_enabled; שתי רשומות delivered/ACTIVE בענן, עם tenant ו־gateway וללא clone flag או revocation. אין בכך אישור שהזהות המקומית משויכת למסלול הענן |
| Auth/session משתמש | UI SESSION WORKS | המשתמש המחובר קורא את מסכי הפיילוט. לא נבדקה מחדש כל מטריצת RLS/תפקידים |
| Auth מכשיר | BLOCKED | health: unavailable בשניהם; HOME_QA TLS נכשל. שגיאות cloud 400 הן מעטפת catch מקומית, לא הוכחה שהענן עצמו דחה payload ב־400 |
| Database | STALE PRODUCTION PROJECTION | רשומות מקור/מכשיר מספטמבר. אין כתיבה או שינוי זהויות. null ב־camera_stream_id אינו כשלעצמו הוכחת mapping פגום במודל המקורות הקנוני |
| Frontend | REFLECTS STALENESS; E2E BLOCKED | UI ללא live/11 offline תואם מידע ענן לא טרי. אין ראיה מספקת לתקלה frontend עצמאית |
| AI | PARTIAL | object_detection loaded/ready; face/biometric flags false; אין הוכחת pipeline חדשה מקצה לקצה |

ערוצים 9 ו־12–16: במסד הם disabled/readiness עם health unknown; בהתקנה המקומית 6 slots unassigned. לכן אינם חלק מ־11 המקורות הפיזיים שנצפו Offline. אין לשנות אותם ל־Offline כדי לנפח denominator. הערוצים הפיזיים הם 1–8,10,11 ובנוסף מקור RTSP/Tapo אחד. פירוט שלוש הדגימות לכל ערוץ ב־live-evidence.json. חלק מסטטוסי הענן ההיסטוריים אינם תואמים למצב המקור המקומי; לא 'תוקנו' ללא הזרמה מאומתת.

## התאמה ל־PUSH 38

ה־PR ההיסטורי [#28](https://github.com/infoganbatuah-ai/gan-batuach/pull/28) נבדק ב־29.10: OPEN / DRAFT / UNMERGED, ראש `e249323ee4555a66672ab55c3bccda863bd47cf8`. גוף ה־PR מתאר שלב ישן מספטמבר. מקור המצב העדיף לפיתוח הוא דוח אוקטובר וה־closure evidence ב־integration/development: מועמד `fd30e9335dbcacb2f06f5536a5ca08b2f8473974`, תיקון epoch drain `eb0dcd9744ad165aa840d65ba3b267844be6546c`, CI run `39073985404` מתועד כהיסטורי בלבד.

הדוח ההיסטורי מוכיח Canary 15/15, 165/165 camera samples, playback 33/33 ו־AI 33/33. שלוש השעות שמרו DVR 1800/1800, Tapo 176/180 ו־AI 65/66, ולכן strict NOT_DONE נשמר. באירוע זה לא בוצע מחדש CI או soak על מועמד קוד חדש; לא שונה runtime. קבלת הפיתוח ההיסטורית אינה מבוטלת, אך אינה סוגרת incident נוכחי או דרישות North-Star.

## שחזור מוכן לביצוע — שער מדויק

מותר להמשיך בבדיקות קריאה בלבד. הצעד התלוי שנותר דורש אישור מפורש להפעלת שירותי HOME_QA המחוברים למצלמות: **חידוש תעודת loopback, התקנת pin תואם וביצוע reload/restart מבוקר של רכיבי QA ושל צרכני התעודה, באותן זהויות וגרסאות חתומות, ללא עדכון OTA חדש.** אין צורך לבקש סיסמה בשיחה.

הסיבה שלא הורץ מנגנון החידוש הקיים אוטומטית: `scripts/qa/renew-push38t-loopback-tls.mjs` בענף PUSH38 יוצר תעודה ומפתח, מחליף trust pin ומפעיל מחדש OTA agents. זה אינו תיקון קובץ מקומי בלבד; agent פעיל עלול לבחור rollout. `reconcile-push38-homeqa-runtime-tls.mjs` כולל עצירה/הפעלה של ה־Gateway/Connector החי. הוראת האירוע מגבילה בדיקות רכיבים פעילים לקריאה בלבד ותיקונים לחסמים מורשים; AGENTS.md הקנוני מורה לא להפעיל שינויי live Gateway/Connector חסומים. לא פורשה הרשאת QA כללית כהיתר להפעיל rollout או להחליף identity.

לפני ההפעלה, על המבצע המורשה:

1. לנעול את current SHA/גרסה/חתימה ו־rollback של 101/40; לגבות בצורה מוגנת את תעודות ה־QA, pins, agent config והגדרות השירות. לא להכניס מפתחות, config פרטי או זהויות ל־Git.
2. לאמת מראש שה־reload אינו מפעיל rollout, מחליף גרסה או מפעיל physical commands. לשמור על HOME_QA ו־loopback בלבד. אם המנגנון הקיים אינו יכול להבטיח זאת, להכין שינוי Development נפרד ולבדוק אותו בסביבה סינתטית לפני החלה.
3. לחדש תעודה עם SAN 127.0.0.1 ו־pin תואם; להחליף אטומית ולשמור rollback. לא להשתמש ב־rejectUnauthorized=false, NODE_TLS_REJECT_UNAUTHORIZED=0 או עקיפת דפדפן.
4. לבצע רק reload/restart שאושר, אחד בכל פעם; לאמת TLS, exact version, חזרת auth ו־QA heartbeat ללא שינוי Site/source/tenant. אין לדרוס credentials או לסובב אותם על סמך expiry של TLS.
5. לבחון בנפרד את מיפוי Product production ↔ HOME_QA. חזרה לצפייה בענן דורשת תכנית חתומה/מאושרת לשיוך זהות ונתיב מדיה HTTPS מותר לספק, עם tenant/site boundaries, ingress מוגבל ותקציב. זהו שינוי Production/מסלול חי אם נדרש, ואינו מאושר באירוע זה.
6. אם DVR ממשיך להיתקע, להשוות per-channel epoch/input/output/decoder diagnostics לגרסה שנחתמה ולנתוני recorder/LAN, בלי login נוסף או פקודה פיזית. חזרה ל־102 או successor דורשת שער OTA נפרד ובדיקות crash/rollback.
7. לאמת 10/10 DVR + 1/1 Tapo, תנועה ממשית בנגן המשתמש, deny wrong-tenant/expired grants, ו־AI eligible-work מקצה לקצה. לאחר מכן Canary חדש, pre-soak חדש ו־24h gate אם נטענת אמינות מלאה. אין למחזר משך היסטורי או להפוך exceptions ל־PASS.

אין כרגע ראיה המחייבת פעולה פיזית בבית, 2FA חדש או ספק בתשלום. אם יידרשו בהמשך, יש להציג בדיוק את הפעולה והראיה לפני ביצועה. אין להמליץ על restart DVR/Tapo ללא אבחון נוסף.

## מסירה ושימור

הקבצים בדוח זה הם תיעוד וראיות מצונזרות בלבד; אין שינוי קוד מוצר, סכמה, קונפיגורציה פעילה, ספק או עלות. `COVERAGE_MATRIX_HE.md` ו־`coverage-matrix.json` מכסים את 52 הפושים ו־197 יכולות North-Star, עם מקור וגבול לכל שורה. בדיקת שלמות מוודאת 52 מספרים ייחודיים ו־197 Stable IDs ייחודיים. בדיקות קוד/חומרה/CI מלא אינן נטענות מכוח כתיבת דוח.

מצב שימור מרוחק, SHA של קומיט התיעוד ופעולת המסירה לצ׳אט האפיון מתועדים ב־HANDOFF.md. אין PR חדש לשחרור ואין בקשת merge ל־main.
