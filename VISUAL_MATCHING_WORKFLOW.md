# Visual Matching Workflow

כל מסך חדש או משודרג חייב לעבור Visual Matching לפני מעבר למסך הבא.

## מסכים ראשונים

בשלב הראשון בודקים רק:

- `login-general`
- `teacher-dashboard-main`
- `teacher-attendance`

אין להמשיך למסכים נוספים עד ששלושת המסכים האלה עוברים בדיקה מול הרפרנסים.

## גדלי צילום

הבדיקה מצלמת שני גדלים קבועים:

- Mobile: `390x844`
- Desktop: `1440x1024`

## קבצי פלט

כל הרצה שומרת קבצים בתוך `.visual-matching/`:

- `mobile-actual.png`
- `desktop-actual.png`
- `mobile-reference-normalized.png`
- `desktop-reference-normalized.png`
- `mobile-diff.png`
- `desktop-diff.png`
- `VISUAL_MATCHING_REPORT.md`

התיקייה הזו לא נכנסת ל-git.

## הרצה

קודם מפעילים את האפליקציה מקומית.

לאחר מכן מריצים:

```bash
npm run visual:match -- login-general
```

לבדיקת שלושת המסכים:

```bash
npm run visual:match -- login-general teacher-dashboard-main teacher-attendance
```

אם השרת לא רץ על `http://127.0.0.1:3000`, משתמשים ב:

```bash
VISUAL_BASE_URL=http://127.0.0.1:3001 npm run visual:match -- login-general
```

## מסכים שדורשים התחברות

`teacher-dashboard-main` ו-`teacher-attendance` דורשים מצב משתמש מחובר.

יש לספק קובץ storage state של Playwright:

```bash
VISUAL_AUTH_STATE=.visual-matching/auth/teacher.json npm run visual:match -- teacher-dashboard-main teacher-attendance
```

בלי `VISUAL_AUTH_STATE`, הצילום עשוי לתפוס redirect למסך ההתחברות ולא את הדשבורד.

## התקנת Playwright

אם Playwright עדיין לא מותקן:

```bash
npm install -D playwright
npx playwright install chromium
```

לאחר מכן אפשר להריץ את הבדיקה.

## כלל עבודה

1. מצלמים actual.
2. משווים מול reference.
3. בודקים את diff.
4. מתקנים spacing, RTL, typography, clipping, colors, card proportions.
5. מריצים שוב.
6. ממשיכים למסך הבא רק אחרי אישור.

## מקורות אמת

- `components/gan-batuach-design-system.tsx`
- `gb-*` tokens מתוך `app/globals.css`
- עמוד ההתחברות הכללי הוא Auth / Brand Baseline.
- דשבורד גננת ראשי הוא Dashboard Baseline.
- `components/premium-dashboard.tsx` הוא legacy ואין להשתמש בו למסכים חדשים.
