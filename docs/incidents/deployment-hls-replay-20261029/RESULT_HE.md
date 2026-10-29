# אימות פריסה, שער משאבים ו־replay של תקיעות HLS — 29.10.2026

DEPLOYMENT_ALIAS_SHA_VERIFIED; ACTIVE_QA_QUALIFICATION_BLOCKED_BY_EXISTING_DISK_GATE; HLS_RECOVERY_NOT_PROVEN; PUSH 38 NOT DONE.

## זהות הענן נסגרה בקריאה בלבד

GitHub combined status של 2da8f75abce610a9a979eecd752d7a6a1011641e הוביל ישירות למסך פריסת Vercel. בסשן הדפדפן המחובר הקיים אומתו Ready / Production / Current, branch main, הקומיט המלא, deployment dpl_GneHPHF1NyWZYrrepnL7rw4JEFrr והכתובת gan-batuach-88da6kcwb-gan-batuach-s-projects.vercel.app. ב־Assigned Domains הופיע במפורש gan-batuach.vercel.app. כך הוכח alias→deployment→SHA, ולא רק סטטוס GitHub היסטורי או header של בקשה. תצוגת Vercel נבדקה גם חזותית; לא שונו הגדרות, לא נוצרה פריסה ולא התבקש/נשמר credential. הצעת הגדרת חשבון נסגרה ללא הגדרת credential או שינוי 2FA.

ה־403 של CLI/API מהיחידה הקודמת נשאר ראיה לכשל במסלול ההוא, אך אינו חסם גישה לאימות SHA עוד. אין צורך לבקש מהבעלים התחברות Vercel לצורך האימות הזה. המקורות הציבוריים שנבדקו קודם (health עם version unknown ו־development/version=404) לא הוצגו כהוכחת SHA; מסך הספק הוא שסגר את הקשר.

ממצא הפער QA–ענן הקודם נשאר: רכיבי HOME_QA מדווחים ל־TLS loopback ולמסד QA, בעוד הענן מציג רשומות ישנות. זיהוי הפריסה אינו אישור לשנות Production או להפנות אליו זהויות QA.

## תיקון הפיך בכלי QA

נמצא בקוד מקור הגרסה המותקנת, commit 2cc9e2b67b0a2a6757adc64e3bf7bf4dff193952, שער qualification קיים של minimum_free_disk_bytes=8GiB. כלי probe-homeqa-memory-media.py לא החיל אותו. הכלי תוקן להחיל את אותו מינימום על filesystem של Digital Observer לפני קריאת credentials, subprocess של Docker/Supabase או בקשת רשת. כונן פרויקט חיצוני מרווח אינו תחליף לכונן שבו Edge ו־HLS פועלים. לא נוספה אפשרות override ולא הונמך הסף.

בדיקה חיה של השער מצאה 290287616 bytes פנויים בלבד, מול 8,589,934,592 bytes נדרשים. הכלי הסתיים עם QA_DISK_HEADROOM_INSUFFICIENT, אפס סבבים וללא סשן/רשת/פענוח. 6/6 בדיקות יחידה עברו, כולל בדיקה שמבטיחה אפס קריאות לפני חסימת המשאבים. המדידות הקודמות נשמרות כתצפיות, ואינן מועלות ל־qualification PASS תחת לחץ המשאבים הזה.

לכן לא הורץ soak פעיל חדש, לא נפתח media claim ולא בוצע forced reconnect. שחרור שער המשאבים דורש הגעה ללפחות 8GiB פנויים בכונן המערכת. לא בוצעו מחיקת קבצים, העברת חומר אישי או נגיעה במסלול הגיבוי. אין להסיר OTA hold או לשנות slot חתום כדי לעקוף את השער.

## תצפית פסיבית ו־replay מדויק של 101

נוסף probe-homeqa-passive-stalls.py: קריאות GET health מקומיות בלבד, שני פורטים, 16 דגימות בהפרשי שש שניות, חלון של 90 שניות. אין Auth, דרישת מדיה, decoder, פקודות או שינוי runtime. נשמרו שתי תצפיות נפרדות:
- first_without_owner: 2026-10-29T18:40:11.190486+00:00, 90.009 שניות, 16 דגימות, 3 כשלים בקריאת health.
- corrected_owner_evidence: 2026-10-29T18:41:47.090185+00:00, 90.038 שניות, 16 דגימות, 0 כשלים בקריאת health.

בתצפית הראשונה לא נאסף owner_state. ה־replay לא הניח שהבעלות CURRENT: הוא דיווח OWNER_NOT_CONFIRMED או INSUFFICIENT_EVIDENCE. החסר תוקן בכלי ובוצעה תצפית נוספת; הקובץ המקורי לא נדרס. גם null לא מומר לאפס, renewal אינו בעלות מתקדמת וערוצים חסרים/כפולים אינם נעלמים מהמונה.

replay-homeqa-stalls.mjs טוען רק את קובץ המדיניות הפונקציונלי של 0.2.101 לאחר SHA256 מדויק 68b8a5f2c181f8cf58a216c2f4c7b0ec2d2243f410f85ba9a351bdc4f995a8c8. הקובץ המותקן זהה byte-for-byte ל־Git באותו source SHA. לא מיובאים server, actuator או מודולי גישה; לא מופעלת פקודת התאוששות.

10/10 בדיקות replay עברו. fixtures סינתטיים הראו: תגובה שהסתיימה נכנסת למסלול OUTPUT_RESCUE הקיים; חתימת VideoToolbox עם קלט טרי ופלט ישן נכנסת אליו; silent רב־ערוצי עם heartbeat בריא שומר deferral; חתימת libx264 עם קלט טרי ופלט ישן אינה מקבלת סמכות OUTPUT_RESCUE במדיניות המותקנת. האחרון הוא גבול של המדיניות והיפותזה לבדיקה, לא הוכחת באג transport חי או אישור להרחיב את סמכות החלפת owner. לא הוחל תיקון runtime על סמך counterexample סינתטי.

ה־replay על התצפית השנייה החזיר {'INSUFFICIENT_EVIDENCE': 142, 'DIRECT_RTSP_NOT_NVR': 16, 'NO_STALL_SIGNATURE': 18}. שמונה ערוצי DVR חסרו בכל 16 הדגימות; CH1 נתן 11 דגימות שלמות ללא חתימת stall וחמש חסרות, CH2 שבע שלמות ותשע חסרות. DIRECT_RTSP_NOT_NVR פירושו שמדיניות DVR אינה חלה על Tapo, לא תוצאת ניגון או PASS. אין כאן שחזור byte-level של התקיעות מהיחידה הקודמת, ולא ניתן לקבוע יציבות מהנתונים החסרים.

## ממצא lifecycle בזמן התצפית

בתצפית הראשונה DVR lifecycle.starts עלה 231→238, לאחר מכן שלוש קריאות health נכשלו, והמונים חזרו לאפס. בתצפית השנייה DVR התחיל בלי relays, אחר כך עלה לאחד ולשניים. לאחר החלון נמדדו ארבעה relays מתקדמים מתוך עשרה מקורות מוגדרים; health=degraded עם EXPECTED_RELAY_NOT_PROGRESSING. Tapo נשאר 1/1 ב־healthy בדגימה שלאחר החלון; זו בריאות מדווחת, לא פענוח חדש.

PID של ילד Gateway הוחלף מ־39587 שתועד ביחידה הקודמת ל־44705; parent 44692. launchd דיווח running, runs=36, last exit code=1. הגרסאות נשארו Gateway 101/build 2cc9e2b6 ו־Connector 40/build d80fb794. היחידה לא שלחה kill/restart/bootstrap/kickstart ולא שינתה שירות. זה מוכיח החלפת תהליך ומחזור עלייה, אך הסיבה ליציאה אינה מוכחת. סיכום הלוג המצונזר לא סיפק סיבת יציאה מאומתת; אין לייחס אותה לדיסק, ל־TLS, ל־OTA או למשימה אחרת על סמך קרבה בזמן.

## rollback, בדיקות והמשך

השינויים הם בכלי QA, בדיקות וראיות בלבד. rollback הוא revert של קומיט היחידה בענף; אין מצב ריצה שנדרש לשחזר. אין שינוי DB/schema/ACL, credentials, main/Production, ספק/חיוב, מסלול גיבוי או פקודה פיזית. לא נוצר סשן Auth או שרת נוסף. התצפיות הסתיימו מעצמן.

16 בדיקות יחידה עברו: 6 Python ו־10 Node; נוסף אימות של השער על נתוני host אמיתיים ושל SHA המדיניות מול הקובץ המותקן ו־Git. אלה בדיקות של כלי האבחון ושערי הבטיחות, לא בדיקות קבלה של המוצר. אין CI/build/release או qualification חדש שהושלם. שימור הקומיט מקומי; remote/ledger/integration נשארים ממתינים במפורש.

ההמשך המאושר לאחר שיקום מרווח הכונן: לקחת baseline יציב של PID/גרסה/בעלות, לתאם בעל runtime יחיד, להריץ אבחון מדיה מוגבל עם input/output ובעלות מלאה, ורק לאחר בידוד להציע מועמד חתום עם rollback ו־canary. החלפת owner או שינוי מדיניות rescue אינם תיקון בטוח מוכח כרגע. בדיקות עומס ו־reconnect יישארו חסומות כל עוד שער 8GiB לא עבר. מצב הענן ידוע כעת, אבל כל שינוי Production מחייב מועמד ושער שחרור נפרדים. PUSH 38 נשאר NOT DONE.
