# מרשם ספקים ובקרת תשתיות

| ספק | תפקיד | מצב נוכחי | פעולה נדרשת |
|---|---|---|---|
| GitHub | קוד ו-CI | מחובר; main לא מוגן | Branch Protection ו-Ruleset |
| VS Code | סביבת פיתוח | כלי מקומי, לא ספק runtime | אין פעולה |
| Vercel | Hosting ו-Deployment | מקושר מקומית | אימות Production, DNS, SSL וחיוב |
| Supabase | Auth, DB, RLS, Storage | מקושר מקומית | אימות migrations, RLS, buckets וגיבוי |
| Domain/DNS | כתובת המערכת | לא הוכח public בבדיקה | DNS, SSL ו-Auth redirect |
| Google Scholar | מחקר | לא אינטגרציה במערכת | אין פעולה |
| Video Gateway | מצלמות | readiness/test | אימות DVR, tokens, health ו-audit |
| Email | הודעות | mock/readiness | Resend/SendGrid/SES לאחר חיבור חשבון |
| WhatsApp/SMS | הודעות | mock/readiness | Business setup, templates ו-webhooks |
| Payments | חיובים | disabled/readiness | sandbox, tokenization ו-webhook חתום |
| Invoices | חשבוניות | mock/readiness | חשבון ספק ו-webhook |
| Push | FCM/APNs/Web Push | disabled/readiness | device-token QA |
| AI/Vision | ניתוח | shadow/readiness | human review ונתוני endpoint |
| Snyk | אבטחה | עתידי | להתחיל Free ולשדרג לפי צורך |

## כלל עלויות

הכנסה: 40 ₪ למשתמש. תקרת עלות כוללת: 15 ₪ למשתמש. יחס מרבי: 37.5%. כל חריגה עוצרת הרחבה ודורשת אופטימיזציה או החלפת ספק.

