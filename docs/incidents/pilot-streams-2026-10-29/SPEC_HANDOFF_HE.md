# סיכום מוכן למסירה לצ׳אט ״אפיון מערכת תצפיתן 3״

הבעלים אישר במפורש את המסירה. **המסמך טרם נמסר**: שני ניסיונות דרך כלי התיאום נכשלו בתקלה טכנית של צ׳אט ללא active turn id; בבדיקת ההיסטוריה לא נמצא הסיכום. ניסיון גישה לממשק האפליקציה נדחה בשל מגבלת בטיחות. לא בוצעה עקיפה. אפשר להעביר את הטקסט להלן ידנית, פעם אחת בלבד.

---

זהו סיכום מסלול incident מקביל, שאינו מבטל את משימת המצלמות הראשית ואינו אישור release. מקור: chat `01a18505-5d8c-7731-829c-0c3eb9c4a6cc`, בתאריך 29.10.2026. הבעלים אישר את תיקון ה־QA ואת העברת הדוח לצ׳אט זה. אין להפריע לתור פעיל או ליצור פקודת הפעלה כפולה.

קומיט התיקון: `8930486ef0d198c3bb0d1c61e6e767ed79ef966a`, ענף `codex/pilot-stream-incident-20261029`. Worktree: `/Users/danielderi/.codex/worktrees/87c7/Gan-Batuach`. אבחון קודם: `72a94701`; דחיית מסירה היסטורית: `14376b72`. יש קומיטים מקומיים, ללא push/PR חדש או integration/main/Production. ששת גייטי ה־CI על מועמד שילוב חדש עדיין אינם מוכחים.

**תוקן ואומת:** תעודת HOME_QA שפגה וה־pins שלה. שתי הרשאות המכשיר חזרו ל־ready. נמצא גם כשל בבעלות השירות: `remote-ingress` שהוגש זמנית ל־launchd היה בעל הפורט הפעיל; `qa-control-ingress` הישן הצביע לתעודה אחרת. השירות הפעיל הוסדר כהגדרה קבועה, עם קוד ותלויות בעותק מקומי פרטי ונעול ב־hashes. הרישום הישן נשמר עם `RunAtLoad=false`.

מנפיק TLS מקומי מוגבל ל־127.0.0.1 תקף עד 28.10.2029 UTC; leaf תקף 30 יום, הנוכחי עד 28.11.2026 UTC. שירות תחזוקה מקומי רץ בעת טעינה וכל שש שעות, מחדש כשנותרו שבעה ימים, ומבצע SIGHUP ל־ingress בלבד. אין צורך ב־restart מצלמות בחידוש רגיל. אין התקנת root ב־OS trust store. מנפיק שמתקרב ל־90 יום לפני פקיעה דורש שינוי אמון מבוקר. אין הבטחת ״לעולם לא תהיה תקלה״.

הגרסאות נשארו Gateway `0.2.101-p38-health` / build `2cc9e2b67b0a2a6757adc64e3bf7bf4dff193952`, ו־Connector `0.2.40-p38-health` / build `d80fb794f0dac331191ff7620b757449dc260b74`. חתימות המניפסטים, הארכיונים ומצביעי current אומתו. לא הוחלפו זהויות, Site/tenant, קוד slots חתום או release. לא הופעל ספק בתשלום ולא בוצעה פקודה פיזית. private keys, סודות וגיבויים נשארו במתחם Application Support פרטי מחוץ ל־Git; לא נעשה שימוש בסיסמה שנמסרה בשיחה.

**OTA:** תהליכי self-healing החתומים הקיימים חזרו לפעול; בחירת והורדת release חדש מוחזקות ב־503 ב־ingress המקומי. לפני release עתידי יש להסיר hold כחלק משינוי נבדק תוך שימור תחזוקת TLS, ולא להחזיר תעודות קצרות שאינן מנוהלות. מקור ה־ingress המקומי אינו תלוי בענף עבודה או בכונן החיצוני; backend QA שומר את תלות הפרויקט הקיימת שלו. לא בוצע reboot/DR מלא.

**בדיקות:** Node 11/11 ו־Python 4/4 עברו, כולל TLS אמיתי ב־Node וב־Python strict, מנפיק/hostname שגויים, pin/tamper/הרשאות/symlink, נעילת חידוש, rollback, התאוששות מ־leaf שפג, race של launchd ואי־שליחת signal לתהליך זר. בוצע leaf rotation חי: המנפיק נשאר זהה, leaf השתנה, peer חדש אומת, anonymous נדחה ב־401, וכל PIDs ומצביעי release נשארו זהים במהלך החידוש; שעון המערכת לא שונה. שירות התחזוקה עצמו סיים exit0 ו־HEALTHY. ניסיונות ההחלה שנעצרו ושוחזרו נשמרו ולא הוצגו כ־PASS.

**האירוע הכולל עדיין OPEN:** תצפית 300,030ms / 21 checkpoints שמרה TLS+anonymous deny ב־21/21, auth ready בשני הרכיבים ב־21/21 ו־Tapo progression ב־21/21. כל עשרת ערוצי ה־DVR היו זמינים אפקטיבית רק ב־10/21; בשארם נצפו 6–9 זמינים. כל עשרת הערוצים התקדמו בו־זמנית ב־5/21. strict all-source progression נשאר false. זו אינה בדיקת soak או Product playback.

מסך rules בענן רוענן בסשן המשתמש הקיים ועדיין הציג ״ממתין ל־Gateway ולספק AI״ ומקורות בלתי זמינים עם עדכונים מספטמבר. זהות QA ב־`https://127.0.0.1:3101` נפרדת מרשומות LEGACY_HMAC בענן; אין להעתיק זהויות QA ל־Production כקיצור דרך. תיקון TLS אינו Product restore ואינו תיקון מוכח לכל כשלי המדיה ב־DVR.

בדיקה נוספת לאחר כ־15 דקות uptime שמרה שתי הרשאות ready ו־TLS401 באותן גרסאות; לא נשלח refresh ידני. באותה נקודה DVR היה 8/10 ו־Tapo 1/1. הראיה היא `post-refresh-auth-check.json`; גם היא אינה PASS של האירוע הכולל.

ה־Gateway חזר מ־102 ל־101 ב־24.10, וה־Connector חזר מ־41 ל־40 ב־20.10 לאחר כשלים מתועדים. קבלת PUSH38 לפיתוח מ־18.10 הייתה חריגה מפורשת ללא clean 24h PASS; ה־NOT_DONE נשמרים. PR28 נבדק קודם כ־OPEN/DRAFT/UNMERGED וגופו מיושן ביחס לראיות אוקטובר. אין לקדם את PUSH38 או North-Star מכוח תיקון זה.

מיפוי מקורות: 16 slots DVR, עשרה assigned בערוצים 1–8,10,11 ושישה unassigned/disabled בערוצים 9,12–16; ועוד Tapo/RTSP אחד. לכן 17 מקורות בכללים מול 11 Offline אינו אובדן שש מצלמות. recorder heartbeat תקין אינו הוכחת progression. המקור לכל stall — recorder/LAN/transcoder/relay — עדיין דורש אבחון נוסף.

**Coverage Matrix:** 52/52 PUSHes ו־197/197 Stable IDs, עם מקור, בעלים, קוד/API/UI/DB/בדיקות, תלות, פער ודרישת הוכחת סיום. 24 VERIFIED היסטוריים בלבד, 137 PARTIAL, 35 PLANNED, 1 BLOCKED; MISSING בתחום ביומטריה/פנים אינו משנה מזהים קנוניים מתוכננים. וידאו, מורשי כניסה וזהות, ביתי/עסקי, onboarding, חקירות/Evidence, API/SDK/OEM/white-label, mobile/legal/economics כלולים. לא נטענה קריאה מחדש של 129 פריטי מקור או שיחות שאינן נגישות.

הראיות והדוחות תחת `docs/incidents/pilot-streams-2026-10-29/`: `RECOVERY_RESULT_HE.md`, `INCIDENT_REPORT_HE.md`, `HANDOFF.md`, `COVERAGE_MATRIX_HE.md`, `coverage-matrix.json`, `canonical-sources.json`, `backend-evidence.json`, `live-evidence.json`, `recovery-health-evidence.json`, `recovery-observation-summary.json`, `live-rotation-evidence.json`, `tls-recovery-application.json`, `tls-maintenance-status.json`, `recovery-source-provenance.json`, `final-local-verification.json`, `product-recheck.json`. SHA-256 תצפית אחרי: `543e1599fdf1ccea720c934b75505e6e4e2c5260c591bc69ec0ecd93d090d547`.

קוד חדש בלבד: חמשת קובצי `scripts/qa/pilot-loopback-tls*`; לא נדרסו קובצי PUSH38 קיימים, integration או עבודה מקבילה. להמשך: לסמן TLS/QA-auth recovery VERIFIED, INCIDENT OVERALL OPEN; לשמר את ה־hold; להכין במסלול המצלמות תכנית נפרדת לכשלי DVR ולשיוך Product identity/media, עם CI, בדיקות tenant/auth, rollback ונתיב ספק מותר בעלות מוגבלת לפני כל הפעלה נוספת. Remote preservation, ששת הגייטים ו־integration עדיין pending. אין main/Production release מכוח אישור ה־QA או סיכום זה.
