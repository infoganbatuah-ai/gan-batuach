# גן בטוח - משימות פיתוח עד הפעלה מלאה

מטרת הרשימה: להביא את גן בטוח מסביבת Demo סינתטית למוצר עובד לגני ילדים, כולל משתמשים, הודעות חיות, תשלום, מצלמות ו-AI עם תצפיתן אנושי. Digital Observer כמוצר עצמאי נשאר שלב נפרד; התשתית שלו בתוך גן בטוח נכללת כאן.

עדכון אחרון: 20 באוגוסט 2026.  
סטטוסים: `DONE`, `PARTIAL`, `READY_TO_EXECUTE`, `NOT_STARTED`, `EXTERNAL_SETUP`, `BLOCKED`.

## תמונת מצב קצרה

- שני חסמי ה-RLS המקוריים: `DONE` לאחר החלת migrations ובדיקת 9 משתמשים.
- QA התחברות/רספונסיביות: `DONE` לכל 9 המצבים ב-3 viewports.
- סביבת Demo מוגנת מפני Live activation: `DONE` בקוד.
- Storage של camera snapshots: `DONE` בסביבת Demo; migration הוחלה ו-sentinel נחסם לכל 9 התפקידים.
- ספקים חיים, Gateway, AI אמיתי ו-Native devices: תלויים בחשבונות/ציוד/SDK ואינם ניתנים לסגירה בקוד מקומי בלבד.

## שלב 0 - שער אבטחה וסביבה

| ID | משימה | מצב | תלות | קריטריון קבלה |
|---|---|---|---|---|
| SEC-01 | להחיל `20260814000100_observer_membership_rls_recursion_fix.sql` ו-`20260819000100_camera_column_privacy_and_observer_rls_reapply.sql` בפרויקט Supabase הנכון | DONE | הוחל על ידי דניאל | Digital Observer ללא `42P17`; עמודות camera credentials חסומות לכל תפקידי browser |
| SEC-02 | להריץ `npm run qa:probe-role-boundaries` לאחר migration | DONE | SEC-01 | 9/9 logins PASS; 8 שערי RLS מקוריים PASS |
| SEC-03 | להריץ בדיקות RLS אוטומטיות לכל 9 מצבי המשתמש ב-CI | DONE | GitHub protected environment | Workflow נוצר ללא credentials בקוד; הרצה אמיתית מקומית עברה |
| SEC-04 | להקשיח `camera-snapshots` ולבדוק Storage browser access | DONE | ללא בסביבת Demo; יש לחזור ב-Pilot | migration הוחלה; 9/9 assertions PASS מול sentinel אמיתי; cleanup PASS |
| SEC-05 | להרחיב write-path RLS לשני גנים ולכל create/update/delete | NOT_STARTED | Pilot environment | כל cross-tenant write נדחה ונרשם ב-audit |
| ENV-01 | ליצור פרויקט Supabase נפרד ל-Pilot ולא להשתמש ב-Demo לנתוני אמת | EXTERNAL_SETUP | החלטת תשתית | project id שונה, migrations זהות, seed סינתטי בלבד לפני אישור |
| ENV-02 | להגדיר `APP_ENV/NEXT_PUBLIC_APP_ENV`, banner סביבתי וכללי קבלת נתוני אמת | DONE | ללא | Build חוסם live modes ללא Production+approval+confirm; Demo מסומן במסכים |
| ENV-03 | להפריד Preview/Production ב-Vercel, Domains, secrets ו-callback URLs | EXTERNAL_SETUP | ENV-01 | אין secret משותף בין Demo/Pilot/Production; callback לכל סביבה |
| OPS-01 | למנות בעל Pilot, תמיכה, פרטיות/אבטחה, rollback, מצלמות, AI ותשלום | EXTERNAL_SETUP | החלטת דניאל | שמות, טלפון/מייל, SLA ו-backup owner ממולאים |
| LEG-01 | Review משפטי/פרטיות למסמכים זמניים ולנוסחי מצלמות/AI/תשלום | EXTERNAL_SETUP | עו"ד/פרטיות | גרסאות מאושרות, תאריך, בעלים, מסלול משיכת הסכמה |

## שלב 1 - ליבת מוצר ו-QA קבוע

| ID | משימה | מצב | תלות | קריטריון קבלה |
|---|---|---|---|---|
| CORE-01 | להפוך את סקריפט role-boundary ל-suite חוזר ב-CI | DONE | SEC-02 | Workflow protected נוצר, ללא סיסמאות בלוג, עם artifact מסונן |
| CORE-02 | בדיקות Browser E2E לכל 9 התפקידים | PARTIAL | ENV-01 | 9/9 התחברו ו-281 צירופי route נסרקו; עדיין נדרש suite קבוע ב-CI לפעולות write |
| CORE-03 | להשלים בדיקות write-path: יצירה/עדכון/מחיקה לפי תפקיד | NOT_STARTED | CORE-02 | אין פעולה בין גנים; audit לכל פעולה רגישה |
| CORE-04 | לתקן את מסכי Admin המציגים נתון unavailable בגלל טבלה/column/migration חסרים | DONE | SEC-01 | Admin schema probe PASS; דשבורד, מפקחים וביקורות נטענים ללא warning |
| CORE-05 | לקבע design regression בצילומי reference | PARTIAL | CORE-02 | 140 ראיות קיימות ו-27 טעינות role/viewport PASS; נדרש diff אוטומטי ב-CI |
| CORE-06 | Accessibility מלאה: keyboard, focus, contrast, labels ו-screen reader | NOT_STARTED | UI יציב | WCAG 2.1 AA למסכי ליבה |
| CORE-07 | רישום מנהלת רציף ללא אישור אדמין | DONE | ללא | 5 שלבים, גן פעיל בסיום, הזמנות אופציונליות |
| CORE-08 | מודל אישור הדדי הורה/גן והעתקת כרטיס ילד | DONE | migrations קיימות | מנהלת מאשרת בקשת הורה; הורה מאשר הזמנת גן; enrollment+timeline נכתבים |
| CORE-09 | ניווט Live בתוך הדשבורד ופרופיל בתוך המסך | DONE | ללא | ללא document reload בפעולות הליבה; טעינה ממותגת ומגירת פרופיל |
| CORE-10 | ניתוב מוקצה/לא מוקצה לכל תפקידי QA | DONE | משתמשים סינתטיים | 9/9 כניסות; פקח מוקצה ל-control-center ולא מוקצה ל-apply |

## שלב 2 - תשלומים וחשבוניות

| ID | משימה | מצב | תלות | קריטריון קבלה |
|---|---|---|---|---|
| PAY-01 | לבחור ספק תשלום ישראלי/Stripe ואת חשבון הסוחר המתאים | EXTERNAL_SETUP | עסק/חשבונאות | הסכם Sandbox, מטבע, VAT, refund ו-chargeback מוגדרים |
| PAY-02 | לממש adapter אמיתי במקום `FutureProviderAdapter` | NOT_STARTED | PAY-01 | checkout sandbox אמיתי, success/cancel חתומים, ללא שמירת כרטיס |
| PAY-03 | להשלים webhook signatures, idempotency ו-replay E2E מול Sandbox | PARTIAL | PAY-02 | קוד signature/idempotency קיים; חסר E2E מול ספק שנבחר |
| PAY-04 | להפריד חשבונאית Gan Batuach subscription, Parent tuition ו-Digital Observer | PARTIAL | PAY-01 | provider mapping, ledger, dashboard ו-webhook שונים לכל stream |
| INV-01 | לבחור ולממש ספק חשבוניות/קבלות | EXTERNAL_SETUP | PAY-01 | חשבונית Sandbox נוצרת פעם אחת וממופה ל-stream הנכון |
| PAY-05 | להריץ Sandbox E2E לכל lifecycle: pending, active, failed, frozen, cancelled | NOT_STARTED | PAY-02, INV-01 | UI, DB, invoice ו-audit עקביים |
| PAY-06 | Live approval gate | NOT_STARTED | PAY-05, LEG-01 | Live כבוי כברירת מחדל; הפעלה רק בחתימה כפולה ובסביבה מאושרת |
| PAY-07 | ניסיון מנהלת 14 יום ללא חיוב מיידי | DONE | ללא | `charge_today_nis=0`, תאריך סיום ניסיון, אין איסוף כרטיס ללא ספק |

## שלב 3 - הודעות חיות

| ID | משימה | מצב | תלות | קריטריון קבלה |
|---|---|---|---|---|
| MSG-01 | לייצב הודעות בתוך המערכת ו-notification center | PARTIAL | CORE-03 | In-app קיים; נדרשים write E2E, wrong-recipient, retry ו-rate limits בסביבת Pilot |
| EMAIL-01 | לממש Resend/SendGrid adapter אמיתי | NOT_STARTED | ENV-03 | שליחת test recipient, callback, unsubscribe ו-no child-sensitive content |
| WA-01 | לפתוח Meta WhatsApp Business, לאשר templates ולממש adapter | EXTERNAL_SETUP | מספר עסקי, LEG-01 | opt-in מתועד, template מאושר, delivery/read callbacks, kill switch |
| SMS-01 | לבחור ספק SMS ולממש adapter | EXTERNAL_SETUP | LEG-01 | opt-in, sender id, delivery callback, rate limit ו-kill switch |
| PUSH-01 | לממש FCM ל-Android/Web ו-APNs ל-iOS | NOT_STARTED | Native setup | token lifecycle, consent, deep link, foreground/background tests |
| MSG-02 | לבנות routing matrix לכל אירוע ותפקיד | NOT_STARTED | EMAIL-01/WA-01/SMS-01/PUSH-01 | Parent A אינו מקבל Child B; admin alerts אינם מגיעים למשתמש רגיל |
| MSG-03 | Production send gate וקמפיין מוגבל | NOT_STARTED | MSG-02 | recipient allow-list, preview, count, approval, rollback ו-delivery dashboard |

## שלב 4 - מצלמות גן ילדים

| ID | משימה | מצב | תלות | קריטריון קבלה |
|---|---|---|---|---|
| CAM-01 | לבחור ולפרוס Video Gateway מבודד (MediaMTX/go2rtc/custom) | EXTERNAL_SETUP | ENV-01 | health endpoint, TLS, secret rotation, network allow-list ו-observability |
| CAM-02 | לממש vault/secret retrieval ל-DVR/NVR credentials | PARTIAL | CAM-01, SEC-01 | encryption וסינון client קיימים; נדרש Vault חיצוני ו-rotation |
| CAM-03 | תהליך onboarding מצלמה לכל גן: DVR/NVR/ONVIF/RTSP | PARTIAL | CAM-01 | UI/API ומצב `pending_gateway` אמיתי קיימים; נדרש Gateway ומצלמת Test |
| CAM-04 | ניגון HLS/WebRTC מאובטח עם token קצר-חיים | PARTIAL | CAM-01, CAM-02 | token bound ל-user/camera/role, expiry, watermark ו-view log |
| CAM-05 | מדיניות צפייה מנהלת/צוות/מפקחת/הורה | PARTIAL | LEG-01, SEC-02 | שעות, הסכמה, audit, kill switch ו-deny-by-default לכל תפקיד |
| CAM-06 | הקלטה, retention, storage, export ו-delete | NOT_STARTED | CAM-01, LEG-01 | תקופת שמירה מאושרת, encryption, deletion job ו-access audit |
| CAM-07 | Pilot טכני עם מצלמת Test שאינה כוללת ילדים | NOT_STARTED | CAM-01..06 | 7 ימי יציבות, reconnect, latency, freeze/offline alerts, no secret leak |
| CAM-08 | Pilot מוגבל בגן אמיתי | BLOCKED | כל שלב 0 ו-CAM-07 | הסכמות, שילוט, RLS, audit, incident runbook וכתב אישור |

## שלב 5 - AI ותצפיתן אנושי בתוך גן בטוח

| ID | משימה | מצב | תלות | קריטריון קבלה |
|---|---|---|---|---|
| AI-01 | לחבר snapshot/frame source מאובטח מה-Gateway | NOT_STARTED | CAM-01, CAM-02 | אין RTSP בדפדפן; frame זמני; metadata/audit בלבד לפי policy |
| AI-02 | לממש inference adapter אמיתי (local HTTP/OpenCV/YOLO) | NOT_STARTED | AI-01 | versioned model, latency/health, no face recognition, no audio |
| AI-03 | להפעיל Shadow עם Synthetic/Test video בלבד | PARTIAL | AI-02, CAM-01 | guardrails ו-queue קיימים; Storage PASS, frame ingestion נשאר נעול עד Gateway ו-Test approval |
| AI-04 | להשלים Human Review workflow | PARTIAL | AI-03 | reviewer assignment, confirm/dismiss/escalate, audit והפרדת תפקידים |
| AI-05 | למדוד false positive/false negative ו-calibration | NOT_STARTED | AI-03 | confusion matrix, thresholds לפי event, dataset version ו-release gate |
| AI-06 | retention/privacy ל-frames, clips, detections ו-review evidence | NOT_STARTED | LEG-01, AI-03 | retention job, access control, delete request ו-no raw frame by default |
| AI-07 | Incident policy ללא האשמה אוטומטית | PARTIAL | AI-04, LEG-01 | ניסוח cautious, human decision required, emergency flow |
| AI-08 | Shadow מוגבל עם נתוני אמת | BLOCKED | CAM-08, AI-01..07 | אישור מפורש, מדדים, owner, audit ו-kill switch; אין parent raw AI |

## שלב 6 - אפליקציות Mobile

| ID | משימה | מצב | תלות | קריטריון קבלה |
|---|---|---|---|---|
| APP-01 | להתקין Android Studio/SDK ולהגדיר `ANDROID_HOME` | EXTERNAL_SETUP | מחשב build | `assembleDebug` PASS |
| APP-02 | להתקין Xcode מלא, provisioning ו-Simulator | EXTERNAL_SETUP | Apple developer | iOS debug build PASS |
| APP-03 | להחליט Remote WebView מול bundled app/offline shell | PARTIAL | ארכיטקטורה | Remote WebView מוגדר ומסונכרן; offline/failure policy טרם אושרה |
| APP-04 | Push permissions, deep links ו-device token registration | NOT_STARTED | PUSH-01 | Android+iOS real-device tests PASS |
| APP-05 | בדיקות WebView: safe area, keyboard, file upload, camera/file permissions | NOT_STARTED | APP-01/02 | כל 9 תפקידים במסכי ליבה על מכשירים אמיתיים |
| APP-06 | Privacy manifests, icons, splash, versioning ו-store metadata | NOT_STARTED | LEG-01 | review checklist מלא ללא הגשה עדיין |
| APP-07 | Beta distribution פנימי | BLOCKED | APP-01..06 | TestFlight/Internal testing, crash monitoring, rollback |

## שלב 7 - תפעול, אמינות והשקה

| ID | משימה | מצב | תלות | קריטריון קבלה |
|---|---|---|---|---|
| OPS-02 | Monitoring, logs, traces ו-alerting | PARTIAL | ENV-01 | request/camera logs מרכזיים צומצמו; חסרים provider חיצוני, retention ו-alerting |
| OPS-03 | Backup/restore ו-Disaster Recovery drill | NOT_STARTED | ENV-01 | restore מתוזמן ומוכח בסביבה נפרדת |
| OPS-04 | Scheduler/queues ל-demo freeze, notification retries, retention ו-AI jobs | NOT_STARTED | ספקים | idempotent jobs, dead-letter queue, alerting |
| OPS-05 | Load, concurrency ו-soak tests | NOT_STARTED | CAM/MSG/PAY | יעדי latency/error rate ו-capacity לגן/רשת |
| OPS-06 | Security review חיצוני ו-penetration test | EXTERNAL_SETUP | כל P0/P1 | אין critical/high פתוחים |
| PILOT-01 | Go/No-Go חדש לפיילוט מוגבל | BLOCKED | SEC, ENV, LEG, OPS וחלקי ספק שנכללים | scope כתוב, no critical/high, signoff מלא |
| PROD-01 | Production launch | BLOCKED | כל השלבים | rollback, support, legal, providers, monitoring, mobile/web QA ו-approval |

## סדר הביצוע המחייב

1. ליצור ENV-01/03 ולמנות OPS-01/LEG-01.
2. להחיל את כל המיגרציות בסביבת Pilot החדשה ולחזור על 9/9 role/storage probes.
3. להשלים CORE-03/05/06 בסביבת Pilot.
4. תשלום והודעות בסביבת Sandbox/Test בלבד.
5. Camera Gateway עם מצלמת Test ללא ילדים.
6. AI Shadow סינתטי עם Human Review.
7. אפליקציות ומכשירים אמיתיים אם נכללים בפיילוט.
8. Pilot Go/No-Go חדש ורק אחריו גן אמיתי בהיקף מוגבל.

אין לדלג ישירות ל-Live. כל משימה שמפעילה ספק חיצוני חייבת לעבור Test/Sandbox, בדיקת recipients, אבטחה, משפטי ו-kill switch.
