# המשך התאוששות DVR — 29.10.2026

מצב: **DVR DEGRADED; צפייה ב־QA/Development לא הוכחה; PUSH 38 NOT DONE.**
ענף `codex/dvr-recovery-20261029`, בסיס `79cc7b42c7b6e0f51b71dd84c61ac84b6f6e2341`.
בעלות: צ׳אט התאוששות 01a18678-402a-7802-b9f7-ec3e8c2ebee6, worktree 8867.

## תוצאות מאומתות

- שחזור חישובי של כל 21 הדגימות המקוריות: 5 PASS ו־16 FAIL. `reconstructed-21.json` מציין לכל דגימה timestamp, ערוצים חסרים, לא מתקדמים ובחידוש. ערוץ חסר נספר ככשל; renewal אינו progression. הראיות המקוריות לא שונו.
- שלוש דגימות חיות ב־07:05:53–07:06:13 UTC תפסו עלייה מחודשת: DVR התחיל ב־0 relays, גילה שוב 16 slots / עשרה מוקצים / שישה לא מוקצים, והגיע לערוץ מתקדם אחד. קודם לכן התקבלה connection refused. משימתנו לא ביצעה restart. אין לייחס את העלייה לפעולתנו או לסיבה ידועה.
- שלוש דגימות לאחר העלייה ב־07:13 UTC: DVR התקדם 7/10, 9/10, 10/10. **רק 1/3 כל העשרה יחד**; אין יציבות מוכחת. Tapo התקדם 1/1 בכל שש הדגימות. מדדי בריאות אינם פענוח תמונה בנגן.
- Gateway נשאר 101/build 2cc9e2b67b0a2a6757adc64e3bf7bf4dff193952; Connector נשאר 40/build d80fb794f0dac331191ff7620b757449dc260b74. הרשאות ready; heartbeat למקליט הצליח, session פעיל אחד וללא rotation בשלוש הדגימות המאוחרות.
- diagnostics מציגים SILENT_RESPONSE_STALL_OWNER_RELEASE, HARDWARE_OUTPUT_STALL_OWNER_RELEASE, source_timeout, SOURCE_STREAM_ENDED, ו־EXCLUSIVE_RESCUE_CONFIRMATION_INCOMPLETE. בערוץ 7 נצפה פער קלט 329ms לעומת פלט 25,959ms באירוע stall שמור; זו ראיה לפער downstream באותו אירוע, לא הוכחה שכל התקיעות ב־decoder. במקביל יש אירועי silent input משותפים למספר ערוצים. אי אפשר לאחד אותם לאבחנת חומרה או LAN ודאית.
- launchd: Gateway running עם runs=3 ויציאה אחרונה 1; Connector runs=1 ללא יציאה. מאזין יחיד ל־18082, ילד של תהליך השירות. stale qa-control-ingress אינו רשום ו־RunAtLoad=false; remote-ingress חי. שתי שגיאות EADDRINUSE היסטוריות חסרות timestamp אינן מוכיחות כפילות נוכחית. לא בוצע kill/reload על סמך אותן שורות.
- maintenance מאשר TLS verified ו־401. probe שלנו מאמת HTTPS עם CA מאושר ומקבל 401 ב־event-manifest. בדגימות העלייה נבדק בטעות route אחר שהחזיר 404; זו הוכחת TLS בלבד ולא הוכחת authorization, והתיקון נבדק בנפרד. מחזור maintenance נשמר, ללא שינוי pin/issuer/OS trust. leaf 30 ימים, threshold שבעה ימים, בדיקה כל שש שעות לפי השירות הקיים.
- Cloudflare המקומי: catch-all 404, אפס hostname entries. זו אינה ראיה לתצורת חשבון מרוחק. לא נוצר DNS, tunnel, ספק או ingress ציבורי.
- UI קיים נקרא ב־Chrome: banner ״ממתין ל-Gateway ולספק AI״; כל המקורות מוצגים לא זמינים והעדכונים מספטמבר. לא נלחץ playback ולא הונפק grant. התאוששות TLS אינה התאוששות המוצר.
- ערוצים 9,12–16 נשארים unassigned/disabled. עשרת הערוצים המוקצים הם 1–8,10,11; Tapo נפרד. פער ההפעלה של ערוץ 2 במוצר לעומת inventory מקומי נשאר לבדיקה; אין לסנכרן אותו אוטומטית.

## Root cause וגבולות

סיבת TLS המקורית הוכחה ותוקנה ב־8930486e; אינה סיבת המשך תקיעות המדיה. הכשל הנוכחי המאומת הוא התקדמות לא רציפה במסלול native input → transcoder → relay, עם כשלים באישור חלופה ובמחזור חיים של Gateway. **שורש התקלה במדיה עדיין לא בודד** בין תזמון תשובת המקליט, input/decoder ופינוי/קידום relay. מאחר שנצפו גם gaps בקלט וגם פער פלט כשהקלט טרי, אין ראיה לתיקון קונפיגורציה יחיד בטוח.

tenant/site: לא שונו זהויות או Production. בדיקת ה־backend ההיסטורית מצביעה על HOME_QA ED25519 מול cloud LEGACY_HMAC; אין התאמה מוכחת. לא בוצעה בדיקת RLS חיה חדשה, wrong-tenant או expired grants. לא נעשה שימוש בהרשאת QA כאישור לשינוי שיוך Product.

## שינוי, גיבוי ו־rollback

נוספו שני כלי אבחון בלבד וקובצי ראיות תחת ספרייה חדשה. לא שונו runtime, שירותים, תעודות, credentials, artifact, OTA, DB, main או Production. לכן אין קונפיגורציה שנדרשה לגבות ואין rollback פעיל לבצע. הגיבויים המוגנים של השחזור הקודם נשארו במקומם ולא נקראו כמפתחות. ביטול יחידת האבחון: revert של קומיט היחידה בענף המבודד; אין להריץ installer כחלק מהביטול.

סיווג: evidence-only/read-only; רגישות metadata תפעולי מצונזר, ללא תמונות/מפתחות/כתובות בית; אפס ספקים חדשים, migrations או משאבים מתמשכים. אין הצהרת עמידה בעלות הפרויקט הכוללת.

## בדיקות

- Node TLS: 11/11 PASS. ניסיון sandbox ראשון נכשל ב־EPERM bind; הרצה מורשית עם listener זמני עברה. הקובץ משמר את תוצאת ההרצה האחרונה בלבד; הכשל מצוין כאן.
- Python installer: 4/4 PASS. discovery ראשוני לא מצא tests (exit 5); הרצה ישירה עברה. לא כונה ניסיון discovery כ־PASS.
- reconstruction: 21 checkpoints, inventory unique, 5 PASS / 16 FAIL; ניתן להרצה חוזרת באמצעות dvr-recovery-reconstruct.py.
- 20 בדיקות גבולות VM, ארבעת hashes והחסימה ב־Virtualization הם ראיות היסטוריות מ־3f57700b ולא הורצו מחדש. לא שוכפלה עבודת VM.
- אין full CI, canary, soak, decoded playback, AI E2E, restart qualification או restore חדשים. אין שינוי מוצר המוצע למיזוג.

## פעולה מדויקת הבאה

1. בעל runtime יחיד ישווה את מועד העלייה ב־07:05 UTC עם לוגי OTA/launchd ושינויי משימות מקבילות. אין restart נוסף לפני התאמת הבעלות והסיבה. error cloud של OTA תואם hold מכוון; אין להסיר hold כדי להשתיקו.
2. להכין בענף review-only replay סינתטי של שני מסלולים: input טרי/output stalled, ו־silent-response רב־ערוצי; להצמיד source SHA של **101 המותקן**, תקציבי timeout ו־exit/handoff. לשמור קלט נוכחי עד אישור חלופה, אך לא לעקוף exclusive-owner או לאפשר session נוסף למקליט. לוגי health לבדם אינם byte-level replay ואינם מאפשרים לטעון שכשל שוחזר ברמת transport.
3. רק לאחר בידוד ותיקון שנבדק, להכין artifact חתום עם rollback ל־101, גיבוי קונפיגורציה מאומת, ומסלול rollout QA מוגדר. אין להחיל 102 שנכשל או לשנות payload מותקן במקום. canonical AGENTS אוסר הפעלת שינויים חיים חסומים; משימה זו לא פותחת שער release/OTA חדש.
4. לצפייה QA נדרש session/grant קצר חיים המוגבל לזהות HOME_QA ול־tenant/site הקנוניים, נגן TLS מאומת ונתיב media פרטי. ingress הנוכחי נבנה בלי remoteSession ולכן מסלולי remote-playback מחזירים 404 לפי המקור. אין לפתוח endpoint ציבורי או להשתמש ב־Production identity כדי לעקוף זאת. קודם להכין תצורת QA מבודדת ואימות deny wrong tenant/site, grant פג ו־origin שגוי; לאחר מכן להוכיח decode ותנועה ל־DVR ול־Tapo בנפרד.
5. אין כרגע צורך מוכח בפקודה פיזית בבית, 2FA, סיסמה חדשה או ספק בתשלום. אין לבקש restart DVR מהבעלים. שינוי Product/Production דורש שער נפרד למועמד ולשיוך המדויקים; טרם הוכן מועמד כזה ולכן אין בקשת אישור עמומה.

## שימור ומסירה

PRESERVED_LOCAL / EVIDENCE_ONLY / INTEGRATION_PENDING. Remote push לא בוצע: טריגרי provider/no-build לא אומתו מחדש; אין להציג שימור מקומי כשימור מרוחק. shared ledgers לא נערכו. מסירה מיועדת פעם אחת ל״אפיון מערכת תצפיתן 3״ עם SHA; תוצאת הכלי תתועד בתשובת הצ׳אט. מטרת חזרת הצפייה נשארת פתוחה, לא הושלמה באמצעות הדוח.
