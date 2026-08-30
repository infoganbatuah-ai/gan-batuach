# דוח ראיות חשבונות, דומיין וגיבויים

תאריך: 2026-08-29

## סיכום

החיבור הטכני לספקים קיים בחלקו, אך לא ניתן לסמן את כל המערכת כמאומתת production ללא ראיות חיות מהחשבונות עצמם.

## ממצאים

| תחום | ממצא | סטטוס |
|---|---|---|
| GitHub | המאגר `infoganbatuah-ai/gan-batuach` נגיש, והרשאות Admin/Push קיימות | מאומת |
| GitHub CI | ריצות Security checks ו-Production checks האחרונות ב-main עברו בהצלחה | תקין לנקודת הזמן |
| GitHub Branch Protection | main וענפי הגיבוי אינם מוגנים | P0 — לטיפול |
| GitHub Rulesets | אין Rulesets פעילים | P0 — לטיפול |
| Vercel | קיים קישור לפרויקט `gan-batuach` | חיבור מקומי בלבד |
| דומיין | הסביבה המקומית מצביעה על `http://localhost:3000`; DNS/SSL ציבוריים לא הוכחו | חסר אימות |
| Supabase | קיימים משתני URL ומפתחות בסביבה המקומית | חיבור מקומי בלבד |
| גיבויים | קיים נוהל גיבוי ושחזור | נוהל בלבד |
| Restore Drill | לא נמצאה הוכחה לביצוע שחזור אמיתי עם snapshot ותוצאות בדיקה | חסר — P0 |
| מצבי ספקים | payments מושבת, invoices mock, communications mock, ללא הפעלה חיה | בטוח כרגע |

## ראיה חיה לדומיין

- `https://ganbatuach.com/` נטען בהצלחה עם כותרת המוצר “גן בטוח”.
- בקשה ל-`http://ganbatuach.com/` הופנתה אוטומטית ל-HTTPS.
- בכך הוכחו DNS/פריסת Vercel/SSL בסיסיים; עדיין נדרשת הקשחת Cloudflare המפורטת להלן.

## ראיות Cloudflare — 2026-08-29

- חשבון Cloudflare נגיש דרך החיבור המאומת: `Info.ganbatuah@gmail.com's Account`.
- Zone: `ganbatuach.com`, סטטוס `active`, לא מושהה, תוכנית `Free Website`.
- Nameservers פעילים: `demi.ns.cloudflare.com`, `logan.ns.cloudflare.com`.
- Apex מחובר ל-Vercel דרך CNAME: `2886c6b90dd0d377.vercel-dns-017.com`.
- `gateway.ganbatuach.com` מחובר ל-Cloudflare Tunnel ומוגדר `proxied`.
- Vercel verification TXT קיים תחת `_vercel.ganbatuach.com`.
- SSL certificate status: `active`; מצב SSL: `Full`.
- DNSSEC: `disabled`.
- HSTS: disabled; Minimum TLS: `1.0`; WAF zone setting: `off`.

### פעולות Cloudflare שנותרו

1. לאמת שה-origin של Vercel תומך ב-Full Strict, ואז לשדרג מ-`Full` ל-`Full (strict)`.
2. להעלות Minimum TLS ל-1.2 לפחות.
3. להפעיל Always Use HTTPS לאחר בדיקת כל ה-hostnames.
4. להפעיל HSTS בהדרגה רק לאחר אימות שכל תתי-הדומיין תומכים HTTPS.
5. להפעיל WAF/Managed Rules אם זמין בתוכנית ובאופן שאינו פוגע בזרימת הווידאו.
6. להפעיל DNSSEC אצל ה-registrar וב-Cloudflare, ולתעד DS record.

הפעולות לעיל הן שינויי production. הן לא בוצעו בשלב הקריאה, כדי למנוע השבתה ללא בדיקת origin ו-registrar.

## פעולות חובה

1. להפעיל Branch Protection ו-Ruleset ב-GitHub.
2. לבצע backup אמיתי ב-Supabase ולבצע Restore בסביבה נפרדת.
3. לאמת DNS, SSL, Vercel Production ו-Auth redirect.
4. לאמת RLS, private buckets, migrations, retention ו-PITR ב-Supabase.
5. להפעיל spend caps והתראות חיוב ב-Vercel וב-Supabase.
6. לתעד לכל ספק חשבון חיוב, health check, backup, restore, fallback וראיה מצורפת.

## כלל אישור

ספק יסומן “תקין” רק לאחר בדיקת שירות חי, חיוב, ניטור, גיבוי ותרגיל שחזור רלוונטי. חיבור token או קובץ configuration לבדם אינם הוכחה מספקת.
