# דניאל - בדיקות Role A/B פשוטות באפליקציה

מטרה: לוודא שכל משתמש רואה רק את מה שמותר לו.

השתמש רק במשתמשים סינתטיים. לא להשתמש בהורים או ילדים אמיתיים.

## Parent A / Parent B

1. התחבר כ-Parent A.
2. פתח Dashboard של הורה.
3. ודא ש-Child A מופיע.
4. נסה לפתוח Child B.
5. רשום תוצאה בצ'קליסט.
6. התנתק.
7. התחבר כ-Parent B.
8. ודא ש-Child B מופיע ו-Child A חסום.

PASS:
- כל הורה רואה רק את הילד שלו.

FAIL:
- הורה רואה ילד שלא שייך לו.

## Manager A / Manager B

1. התחבר כ-Manager A.
2. ודא ש-Kindergarten A מופיע.
3. נסה לפתוח Kindergarten B.
4. התנתק.
5. התחבר כ-Manager B.
6. ודא ש-Kindergarten B מופיע ו-Kindergarten A חסום.

PASS:
- כל מנהל רואה רק את הגן שלו.

FAIL:
- מנהל רואה גן אחר.

## Staff

1. התחבר כ-staff_unassigned_test.
2. ודא שאין גישה לילדים, הורים, מסמכים ונוכחות.
3. התנתק.
4. התחבר כ-staff_assigned_a_test.
5. ודא שיש רק הקשר עבודה של Kindergarten A.
6. נסה לפתוח Kindergarten B.

PASS:
- צוות לא משויך חסום.
- צוות משויך רואה רק את מה שמותר לו.

FAIL:
- צוות לא משויך רואה ילדים/הורים.
- צוות A רואה גן B.

## Inspector

1. התחבר כ-inspector_unassigned_test.
2. ודא שאין גנים.
3. התנתק.
4. התחבר כ-inspector_assigned_a_test.
5. ודא ש-Kindergarten A מופיע.
6. נסה לפתוח Kindergarten B.

PASS:
- פקח לא משויך לא רואה גנים.
- פקח משויך רואה רק את הגן שלו.

FAIL:
- פקח רואה גן לא משויך.

## Provider / Camera / AI

בכל תפקיד שאינו Admin:

- נסה לראות רשומות תשלום/Provider.
- נסה לראות RTSP או סיסמאות מצלמה.
- נסה לראות Raw AI.

PASS:
- הכל חסום.

FAIL:
- מידע רגיש מופיע.

## איפה לרשום?

מלא את סעיף C ב-`DANIEL_MASTER_SIGNOFF_CHECKLIST_FILL_THIS_HE.md`.

