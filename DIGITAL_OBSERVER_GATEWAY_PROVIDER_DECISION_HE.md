# בחירת Camera Gateway משותף - החלטה לפני הפעלה

תאריך: 21.8.2026

## המצב הנוכחי

- שכבת הקוד כבר מכירה `mediamtx`, `go2rtc` ו-`custom` דרך `lib/domain/video-gateway-client.ts`.
- קיימים נתיבי שרת לבדיקת health, רישום מקור, playback והשבתה.
- פרטי RTSP, שם משתמש, סיסמה וסוד Gateway נשארים בצד השרת ואינם נשלחים לדפדפן.
- אין כרגע ב-Vercel כתובת Gateway, כתובת playback ציבורית או סוד חתימה, ולכן היישום מציג `pending_gateway` ואינו טוען שווידאו חי עובד.
- לא הותקן ולא הופעל שירות חיצוני במסגרת הבדיקה הזו.

## מה ה-Gateway חייב לספק

1. גישה מקומית מאובטחת למצלמה, NVR או DVR בלי לחשוף אותם לאינטרנט.
2. קליטת RTSP ויכולת שימוש ב-ONVIF לצורך איתור וקבלת כתובת stream במצלמות תואמות.
3. המרה ל-WebRTC או HLS שהדפדפן והאפליקציה יכולים לנגן.
4. הרשאה קצרה ומוגבלת לפי מוצר, tenant, אתר ומצלמה.
5. Control API פנימי, health, metrics, timeout וניתוק כפוי.
6. snapshot וקטע אירוע בלי להעביר RTSP או סיסמה ללקוח.
7. namespace נפרד לשני המוצרים, גם אם התשתית משותפת:
   - `gan-batuach/{gardenId}/{cameraId}`
   - `digital-observer/{siteId}/{cameraId}`
8. audit לכל פתיחת session ואיסור גישה להורה רק מכוח היותו משתמש במערכת.

## השוואה קצרה

| אפשרות | יתרון מרכזי | מגבלה מרכזית | התאמה לקוד הנוכחי |
|---|---|---|---|
| MediaMTX | שרת מדיה ממוקד עם RTSP, WebRTC, HLS, recording, Control API, metrics ואימות HTTP/JWT | אינו אשף אוניברסלי לזיווג מצלמות קנייניות; ONVIF/QR וספקי ענן דורשים Adapter/Edge נוסף | גבוהה; adapter קיים אך יש להשלים אימות provider-specific לפני הפעלה |
| go2rtc | תאימות Edge רחבה למקורות ביתיים, ONVIF, RTSP, HomeKit וסוגי מצלמות נוספים | מתאים מאוד לשכבת התאימות המקומית, אך לבדו דורש הקשחה תפעולית והרשאות לפני שימוש כשער מרכזי רב-לקוחות | בינונית-גבוהה; adapter קיים אך חוזה ה-API והאימות דורשים בדיקת גרסה בפועל |
| Gateway מותאם אישית | שליטה מלאה ב-API, הרשאות, audit וזרימת AI | זמן פיתוח, תחזוקה וסיכון גבוהים יותר; עדיין יישען על מנוע מדיה קיים | הקוד תומך בחוזה `custom`, אך אין שירות פרוס |

מקורות טכניים ראשיים:

- MediaMTX: https://mediamtx.org/docs/kickoff/introduction
- MediaMTX authentication: https://mediamtx.org/docs/features/authentication
- go2rtc: https://github.com/AlexxIT/go2rtc
- ONVIF Profile T: https://www.onvif.org/profiles/profile-t/

## ההמלצה

**להתחיל ב-MediaMTX כליבת הווידאו המשותפת, ולהוסיף go2rtc רק כרכיב Edge/Compatibility כאשר מצלמה אינה מספקת RTSP/ONVIF תקין.**

הסיבה:

- MediaMTX נותן בסיס מסודר ל-WebRTC/HLS, הקלטה, Control API, metrics ואימות.
- go2rtc מרחיב תאימות למצלמות ביתיות וקנייניות בלי להפוך אותו למקור האמת להרשאות ול-audit.
- היישום הקיים נשאר מקור האמת ל-tenant, הרשאה, token, session ו-audit.
- אותה תשתית יכולה לשרת את שני המוצרים, אך כל path, token ו-record נשארים מופרדים לפי מוצר ואתר.

## מסלול בדיקה מומלץ לאחר אישור

1. להריץ MediaMTX ב-Docker על מחשב/mini-PC באותה רשת של מצלמת בדיקה לא-פרטית.
2. להתחיל במצלמה אחת שתומכת RTSP או ONVIF, בלי וידאו של ילדים ובלי כתובת בית פרטית.
3. לחבר את אפליקציית השרת ל-Control API פנימי דרך TLS/VPN; לא לחשוף את API הניהול לציבור.
4. להוסיף שכבת auth קצרה ל-HLS/WebRTC ולוודא ש-URL של מקור ה-RTSP לעולם אינו מגיע לדפדפן.
5. לבדוק health, preview, ניתוק, token expiry, audit ו-last seen.
6. רק אם המצלמה אינה תואמת, להוסיף go2rtc מקומי כ-Adapter ולנרמל את הפלט ל-MediaMTX.
7. רק לאחר מעבר הבדיקות לחבר frame/snapshot ל-AI Shadow.

## ההחלטה הנדרשת מדניאל

יש לאשר אחת משלוש אפשרויות לפני התקנה או יצירת סודות:

- **אפשרות A - מומלץ:** MediaMTX כליבה + go2rtc אופציונלי ב-Edge.
- **אפשרות B:** go2rtc בלבד לצורך Proof of Concept מצומצם.
- **אפשרות C:** Gateway מותאם אישית מהשלב הראשון.

בנוסף צריך לציין על איזה מחשב או יחידת Edge ברשת תורץ בדיקת המעבדה, ומהו סוג מצלמת הבדיקה: IP/ONVIF, RTSP ישיר או NVR/DVR.

## מה לא יקרה לפני האישור

- לא יוגדרו `VIDEO_GATEWAY_URL`, `VIDEO_GATEWAY_PUBLIC_URL` או סוד חתימה.
- לא יוזנו סיסמאות מצלמה ב-Vercel, בקוד או בצ'אט.
- לא תופעל צפייה להורים.
- לא יופעל AI חי, זיהוי פנים, אודיו או חיוג חירום.
- לא יוצג סטטוס `connected` לפני smoke test אמיתי.
