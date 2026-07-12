# דניאל - צעדים פשוטים לבדיקת Supabase/RLS

## מה זה RLS בשפה פשוטה?

RLS אומר: גם אם מישהו משנה את הפרונטאנד, משנה כתובת בדפדפן או מנסה לקרוא API ישירות, Supabase עצמו חייב לחסום מידע שלא שייך לו.

המטרה היא להוכיח ש-Supabase לא נותן להורה, מנהל, צוות או פקח לראות מידע שלא שייך להם.

## איפה נכנסים?

1. פתח את Supabase Dashboard.
2. בחר את הפרויקט שבו אמור להיות הפיילוט.
3. ודא שזה לא פרויקט Production עם נתונים אמיתיים.
4. פתח את Authentication כדי לראות משתמשים.
5. פתח את Table Editor כדי לבדוק נתונים.
6. אם צריך SQL, פתח SQL Editor, אבל הרץ רק בדיקות קריאה, לא מחיקה ולא עדכון.

## אילו משתמשים צריך?

צריך משתמשים סינתטיים בלבד:

- admin_test
- manager_a_test
- manager_b_test
- parent_a_test
- parent_b_test
- staff_unassigned_test
- staff_assigned_a_test
- inspector_unassigned_test
- inspector_assigned_a_test

אם המשתמשים לא קיימים, עצור וסמן BLOCKED. אל תשתמש בהורים/ילדים אמיתיים.

## איזה דאטה צריך?

- Kindergarten A
- Kindergarten B
- Child A משויך ל-Parent A ול-Kindergarten A
- Child B משויך ל-Parent B ול-Kindergarten B
- Staff assigned A משויך רק ל-Kindergarten A
- Inspector assigned A משויך רק ל-Kindergarten A
- רשומת תשלום/מנוי ל-Kindergarten A
- רשומת מצלמה במצב readiness ל-Kindergarten A
- רשומת AI במצב readiness/shadow ל-Kindergarten A
- מסמך פרטי ל-Child A
- מסמך פרטי ל-Child B

אם הדאטה לא קיים, עצור וסמן BLOCKED.

## איך בודקים Parent A מול Child B?

דרך פשוטה:

1. התחבר באפליקציה כ-Parent A.
2. ודא ש-Child A מופיע.
3. נסה לפתוח את הקישור או המסך של Child B.
4. נסה לחפש דרך המסכים רשימת ילדים שלמה.

PASS:
- Child A מופיע.
- Child B לא מופיע.
- אין רשימת כל הילדים.

FAIL:
- Parent A רואה Child B.
- Parent A רואה רשימת ילדים מלאה.

צילום מסך:
- צילום של Child A מופיע.
- צילום של Child B חסום או לא נמצא.

## איך בודקים Manager A מול Kindergarten B?

1. התחבר כ-Manager A.
2. ודא ש-Kindergarten A מופיע.
3. נסה לפתוח כתובת/מסך של Kindergarten B.

PASS:
- Manager A רואה רק Kindergarten A.
- Kindergarten B חסום, לא קיים או מחזיר הודעת הרשאה.

FAIL:
- Manager A רואה Kindergarten B.

## איך בודקים Staff?

1. התחבר כ-staff_unassigned_test.
2. נסה לפתוח ילדים, הורים, מסמכים ונוכחות.
3. התחבר כ-staff_assigned_a_test.
4. ודא שהוא רואה רק הקשר עבודה של Kindergarten A.
5. נסה לפתוח Kindergarten B.

PASS:
- Staff לא משויך לא רואה ילדים/הורים.
- Staff משויך לא רואה Kindergarten B.

FAIL:
- Staff לא משויך רואה ילדים או הורים.
- Staff A רואה Kindergarten B.

## איך בודקים Inspector?

1. התחבר כ-inspector_unassigned_test.
2. ודא שאין גנים.
3. התחבר כ-inspector_assigned_a_test.
4. ודא שרק Kindergarten A מופיע.
5. נסה לפתוח Kindergarten B.

PASS:
- פקח לא משויך לא רואה גנים.
- פקח משויך ל-A לא רואה B.

FAIL:
- פקח לא משויך רואה גן.
- פקח A רואה גן B.

## מה בדיוק לצלם?

לכל בדיקה חשובה:

- צילום מסך של המשתמש המחובר.
- צילום מסך של הדבר שמותר לראות.
- צילום מסך של החסימה או הודעת אין הרשאה.
- אם יש FAIL, לצלם ברור את המידע שנחשף.

## מה לכתוב בתוצאה?

ב-`DANIEL_MASTER_SIGNOFF_CHECKLIST_FILL_THIS_HE.md`:

- Actual result: מה ראית בפועל.
- PASS / FAIL / BLOCKED: לבחור אחד.
- Evidence: שם קובץ צילום מסך או קישור.
- Notes: הסבר קצר.

אם יש FAIL אחד ב-RLS, לא ממשיכים לפיילוט עם נתונים אמיתיים.

