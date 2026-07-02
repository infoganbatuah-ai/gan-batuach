# הוראות Setup ידניות לדניאל – PILOT FIX 4

תאריך: 2026-07-03

## 1. לאשר איזו סביבה היא איזו

צריך לוודא ולתעד:

1. איזה Supabase הוא Demo/Internal.
2. איזה Supabase מיועד ל־Pilot/Staging.
3. האם יש Supabase Production נפרד.
4. איזה Vercel deployment הוא Demo.
5. איזה Vercel deployment הוא Pilot/Staging.
6. איזה Vercel deployment הוא Production.

לא לערבב ביניהם.

## 2. מה אסור לגעת בו עכשיו

לא להכניס עדיין:

- ילדים אמיתיים
- הורים אמיתיים
- מסמכים אמיתיים של ילדים/צוות
- פרטי מצלמות אמיתיים
- RTSP / כתובות IP מקומיות של מצלמות
- תשלומים אמיתיים
- AI אמיתי על ילדים

## 3. חשבונות שצריך להכין לפיילוט בדיקות

ל־PILOT FIX 5 צריך חשבונות סינתטיים:

- `demo_admin`
- `demo_manager_a`
- `demo_manager_b`
- `demo_parent_a`
- `demo_parent_b`
- `demo_staff_unassigned`
- `demo_staff_assigned_a`
- `demo_inspector_unassigned`
- `demo_inspector_assigned_a`
- `demo_digital_observer_admin` אם בודקים גם Digital Observer

סיסמאות לא נכנסות לקוד. הן נוצרות ידנית או נמסרות דרך משתני סביבה זמניים.

## 4. נתונים סינתטיים שצריך להכין

צריך שני גנים:

- Kindergarten A
- Kindergarten B

וצריך:

- Child A שייך ל־Parent A ול־Kindergarten A
- Child B שייך ל־Parent B ול־Kindergarten B
- Staff assigned A שייך רק ל־Kindergarten A
- Inspector assigned A שייך רק ל־Kindergarten A
- רשומת תשלום/מנוי דמו ל־Kindergarten A
- רשומת מצלמה דמו בלי סודות
- אירוע AI דמו/Shadow שלא גלוי להורה

## 5. מתי מותר להכניס גן אמיתי

אפשר להכניס גן אמיתי רק אחרי:

1. סביבת Pilot/Staging מאושרת.
2. RLS נבדק ב־Supabase אמיתי.
3. מסמכי Privacy/Terms/Child Data/Manager Terms מוכנים לסקירה.
4. יש אישור פנימי מדניאל.
5. יש דרך לעצור/לכבות פיצ׳רים מסוכנים.

## 6. מתי מותר להכניס הורים/ילדים אמיתיים

רק אחרי:

1. בדיקת RLS ידנית עם משתמשים אמיתיים/סינתטיים.
2. אישור משפטי/פרטיות או החלטה מפורשת של דניאל.
3. הסכמת הורה/אפוטרופוס.
4. מדיניות שמירת/מחיקת מידע.
5. בדיקת Storage ו־Signed URLs.

## 7. למה צריך להריץ `npx cap sync`

בגלל שבוצעו שינויי CSS/Layout בשלב Responsive Fix 2, צריך לסנכרן מחדש לפני בדיקת Native/Mobile הבאה.

השלב הזה לא חייב להריץ בדיקת מובייל מלאה, אבל לפני MOBILE QA הבא צריך להריץ:

`npx cap sync`

ואז לבצע בדיקת מכשיר/אמולטור.

## 8. המלצה לשלב הבא

אפשר להמשיך ל־PILOT FIX 5 עם נתונים סינתטיים בלבד.

לא להתחיל פיילוט אמיתי עם ילדים/הורים אמיתיים עד ש־RLS, משפטי, סביבה ותמיכה סגורים.

