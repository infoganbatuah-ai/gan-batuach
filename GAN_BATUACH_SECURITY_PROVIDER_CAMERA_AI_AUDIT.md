# גן בטוח - אבטחה, ספקים, מצלמות ו-AI

תאריך: 20 באוגוסט 2026

## RLS ואבטחת תפקידים

- שתי המיגרציות המקוריות הוחלו ב-Supabase.
- 9/9 משתמשי QA התחברו.
- Digital Observer RLS recursion תוקן; אין `42P17`.
- camera credential/private endpoint columns חסומות לכל תפקידי browser.
- הורה אינו רואה raw AI.
- צוות/הורה/מפקחת לא משויכים מקבלים 0 נתוני ילדים/גנים רגישים.
- provider health חסום מחוץ לאדמין.
- Service Role נשאר server-side בלבד.

## Storage

הבדיקה המורחבת גילתה שתי policies ישנות שאפשרו ל-`authenticated` לקרוא/להעלות ב-`camera-snapshots`. דניאל החיל את התיקון:

תיקון מוכן:

`supabase/migrations/20260820000100_camera_snapshot_storage_privacy_hardening.sql`

אימות Remote לאחר ההחלה:

- נוצר sentinel סינתטי זמני באמצעות Service Role בצד השרת בלבד.
- 9/9 תפקידי הדפדפן לא ראו אותו ברשימה ולא יכלו להוריד אותו.
- הקובץ נמחק בסיום: PASS.
- בדיקת גבולות מלאה: 9/9 assertions PASS.

מנעולי ברירת מחדל שנשארים עד חיבור Gateway מאושר:

- `CAMERA_SNAPSHOT_STORAGE_RLS_VERIFIED=false` כברירת מחדל.
- `POST /api/camera-snapshots` מחזיר 503 עד אימות Remote.
- AI snapshot ingestion נדחה עד אימות Remote.
- `npm run qa:storage-policy-safety`: 6/6 PASS סטטי.

הדגל אינו מופעל אוטומטית. ניתן להגדירו `true` רק בסביבת Test/Pilot מאושרת כאשר מתחיל חיבור snapshots סינתטיים דרך Gateway.

## Environment ו-Live kill switches

- `APP_ENV` ו-`NEXT_PUBLIC_APP_ENV` מוגדרים בדוגמה כ-`demo`.
- Build חוסם live provider mode מחוץ ל-Production.
- Production דורש גם `PRODUCTION_ACTIVATION_APPROVED=true` וגם confirmation phrase מדויקת.
- ניסיון `PAYMENT_MODE=live APP_ENV=demo` נחסם בשלושה guardrails.
- Banner מציג Demo/נתונים סינתטיים.

## תשלומים וחשבוניות

- Payment adapter: ידני/readiness בלבד; אין checkout או card collection חי.
- Webhook infrastructure כוללת signature, idempotency/replay record ו-no raw body storage.
- Side effects מופעלים רק אם mode חי, configuration מלאה וחתימה תקינה.
- Invoice: readiness בלבד; אין חשבונית Production.
- Revenue streams מוגדרים כ-`gan_batuach_subscription`, `parent_tuition`, `digital_observer`.
- נדרש ספק שנבחר ו-Sandbox E2E לפני כל טענה מוכנות חיה.

## Email, SMS, WhatsApp ו-Push

- ברירת המחדל mock/dry-run; אין Production send.
- בדיקת אינטגרציה אדמינית שומרת `sent_mock` ו-`real_send:false` בלבד.
- SMS dry-run שומר אורך הודעה, לא את גוף ההודעה.
- WhatsApp dry-run שומר נמען מוסווה ומטא-דאטה מצומצם, לא token/payload מלא.
- Push אינו מסומן real-send ללא adapter אמיתי.
- נדרשים חשבונות ספק, consent/opt-in, allow-list, callbacks ובדיקות wrong-recipient.

## מצלמות

- אין RTSP/host/password/username בדפדפן.
- playback endpoint קורא מידע פרטי server-side רק לאחר RLS, תפקיד ושיוך.
- DVR/RTSP credentials מוצפנים ונשמרים server-side; עדיין נדרש Vault חיצוני ו-rotation.
- Gateway שאינו מוגדר מחזיר/שומר `pending_gateway`, לא `connected`.
- תשובות Gateway מסוננות ואינן מחזירות credentials.
- Parent viewing נשאר disabled.
- אין Gateway פעיל, מצלמה אמיתית, recording או retention מוכחים.

## AI

- מצב ברירת מחדל: mock/shadow/readiness.
- Human Review נדרש תמיד.
- Parent raw visibility: false.
- Face recognition, audio analytics, automatic accusation/decision: חסומים.
- אין frame source חי ואין inference provider אמיתי.
- frame ingestion נשאר חסום עד Gateway, מקור frame סינתטי ומדיניות Test מאושרת; שער ה-Storage עבר.

## Logging ו-Secrets

- middleware אינו מדפיס עוד UUID/IP/User-Agent ב-Production console.
- לוגי camera access מרכזיים צומצמו לספירות/סיבות ללא מזהים.
- SMS/WhatsApp dry-run עברו redaction.
- audit DB תפעולי עדיין עשוי להכיל IP/User-Agent בהתאם למדיניות; נדרש retention review לפני נתוני אמת.
- לא נמצאו Service Role, provider key, RTSP credential או סיסמת QA ב-client bundle/public/report.

## החלטה

`SECURITY_ROLE_AND_STORAGE_BOUNDARIES_PASS_LIVE_PROVIDERS_AND_HARDWARE_NOT_CONFIGURED`

המערכת בטוחה ל-QA סינתטי. היא אינה מאושרת למצלמות/AI frames או לספקים חיים עד השלמת Gateway, חומרת Test, ספקים, מדיניות ואישורים חיצוניים.
