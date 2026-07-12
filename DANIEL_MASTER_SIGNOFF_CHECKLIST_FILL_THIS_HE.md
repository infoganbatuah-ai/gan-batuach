# צ'קליסט מאסטר לדניאל - למלא את הקובץ הזה בלבד

הוראות: מלא את הטבלה. אם משהו לא ברור, כתוב BLOCKED והסבר בהערות.  
אסור להשתמש בנתונים אמיתיים של ילדים/הורים בזמן הבדיקות.

## A. סביבה

| # | Area | What to check | How to check | Expected result | Actual result | PASS / FAIL / BLOCKED | Evidence link/screenshot | Notes |
|---|---|---|---|---|---|---|---|---|
| A1 | Environment | שם פרויקט Supabase | לפתוח Supabase Dashboard | שם פרויקט ברור |  |  |  |  |
| A2 | Environment | סוג סביבה | לבדוק האם local/demo/staging/pilot/production | לא Production לפיילוט ניסוי |  |  |  |  |
| A3 | Environment | נתוני ילדים אמיתיים | לבדוק שאין נתונים אמיתיים | No |  |  |  |  |
| A4 | Environment | תשלומים חיים | לבדוק Provider/Env/Admin | Disabled/manual/sandbox |  |  |  |  |
| A5 | Environment | צפיית הורים במצלמות | לבדוק Admin/Camera settings | Disabled |  |  |  |  |
| A6 | Environment | AI חי | לבדוק Admin/AI settings | Disabled/readiness/shadow only |  |  |  |  |
| A7 | Environment | SMS/WhatsApp חיים | לבדוק Provider settings | Disabled/test only |  |  |  |  |

## B. Supabase/RLS

| # | Area | What to check | How to check | Expected result | Actual result | PASS / FAIL / BLOCKED | Evidence link/screenshot | Notes |
|---|---|---|---|---|---|---|---|---|
| B1 | RLS | Parent A sees Child A | להתחבר כ-Parent A או לבדוק בסופאבייס עם המשתמש | Child A visible |  |  |  |  |
| B2 | RLS | Parent A blocked from Child B | לנסות לפתוח/לשלוף Child B | Blocked/no rows |  |  |  |  |
| B3 | RLS | Parent A cannot list all children | לנסות לראות רשימת כל הילדים | Blocked/only own child |  |  |  |  |
| B4 | RLS | Manager A blocked from Kindergarten B | לנסות לפתוח גן B | Blocked/no rows |  |  |  |  |
| B5 | RLS | Staff unassigned blocked | להתחבר כצוות לא משויך | No child/parent access |  |  |  |  |
| B6 | RLS | Staff assigned A blocked from Kindergarten B | להתחבר כצוות משויך ל-A | Kindergarten B blocked |  |  |  |  |
| B7 | RLS | Inspector unassigned blocked | להתחבר כפקח לא משויך | No garden access |  |  |  |  |
| B8 | RLS | Inspector assigned A blocked from Kindergarten B | להתחבר כפקח משויך ל-A | Kindergarten B blocked |  |  |  |  |
| B9 | RLS | Provider/payment records protected | לנסות עם parent/staff/inspector | Blocked |  |  |  |  |
| B10 | RLS | Camera credentials protected | לנסות לראות RTSP/סיסמאות | Never visible |  |  |  |  |
| B11 | RLS | Raw AI protected | לנסות לראות Raw AI כהורה | Blocked |  |  |  |  |
| B12 | RLS | Documents private | לבדוק מסמך פרטי | Unauthorized blocked |  |  |  |  |

## C. Role A/B באפליקציה

| # | Area | What to check | How to check | Expected result | Actual result | PASS / FAIL / BLOCKED | Evidence link/screenshot | Notes |
|---|---|---|---|---|---|---|---|---|
| C1 | Role A/B | Parent A / Parent B | להתחבר לשני המשתמשים | כל הורה רואה רק ילד שלו |  |  |  |  |
| C2 | Role A/B | Manager A / Manager B | להתחבר לשני המנהלים | כל מנהל רואה רק גן שלו |  |  |  |  |
| C3 | Role A/B | Staff unassigned / assigned | לבדוק שני משתמשי צוות | לא משויך חסום, משויך מוגבל |  |  |  |  |
| C4 | Role A/B | Inspector unassigned / assigned | לבדוק שני פקחים | לא משויך חסום, משויך מוגבל |  |  |  |  |

## D. Support/Incident

| # | Area | What to check | How to check | Expected result | Actual result | PASS / FAIL / BLOCKED | Evidence link/screenshot | Notes |
|---|---|---|---|---|---|---|---|---|
| D1 | Support | Pilot owner | למלא שם וטלפון/אימייל | Owner assigned |  |  |  |  |
| D2 | Support | Technical owner | למלא שם וטלפון/אימייל | Owner assigned |  |  |  |  |
| D3 | Support | Privacy/security owner | למלא שם וטלפון/אימייל | Owner assigned |  |  |  |  |
| D4 | Support | Rollback owner | למלא שם וטלפון/אימייל | Owner assigned |  |  |  |  |
| D5 | Support | Support contact | למלא טלפון/אימייל | Active contact |  |  |  |  |

## E. Visual Review

| # | Area | What to check | How to check | Expected result | Actual result | PASS / FAIL / BLOCKED | Evidence link/screenshot | Notes |
|---|---|---|---|---|---|---|---|---|
| E1 | Visual | Mobile 390 x 844 | Chrome DevTools | No cuts/overflow |  |  |  |  |
| E2 | Visual | Mobile 430 x 932 | Chrome DevTools | No cuts/overflow |  |  |  |  |
| E3 | Visual | Tablet 768 x 1024 | Chrome DevTools | Coherent layout |  |  |  |  |
| E4 | Visual | Desktop 1366 x 768 | Browser | Organized desktop |  |  |  |  |
| E5 | Visual | Desktop 1440 x 900 | Browser | Organized desktop |  |  |  |  |

## F. Legal/Privacy

| # | Area | What to check | How to check | Expected result | Actual result | PASS / FAIL / BLOCKED | Evidence link/screenshot | Notes |
|---|---|---|---|---|---|---|---|---|
| F1 | Legal | Privacy/Terms reviewed | Lawyer/privacy reviewer or Daniel risk acceptance | Reviewed or accepted |  |  |  |  |
| F2 | Legal | Child data notice reviewed | Lawyer/privacy reviewer or Daniel risk acceptance | Reviewed or accepted |  |  |  |  |
| F3 | Legal | Parent consent reviewed | Lawyer/privacy reviewer or Daniel risk acceptance | Reviewed or accepted |  |  |  |  |
| F4 | Legal | Camera/AI notices reviewed | Lawyer/privacy reviewer or Daniel risk acceptance | Reviewed or accepted |  |  |  |  |
| F5 | Legal | Account deletion/support reviewed | Lawyer/privacy reviewer or Daniel risk acceptance | Reviewed or accepted |  |  |  |  |

## G. Final Decision

| # | Area | What to check | How to check | Expected result | Actual result | PASS / FAIL / BLOCKED | Evidence link/screenshot | Notes |
|---|---|---|---|---|---|---|---|---|
| G1 | Final | All critical items pass | Review this checklist | No critical FAIL/BLOCKED |  |  |  |  |
| G2 | Final | Ready to ask Codex for PILOT QA 2 | Fill send-back template | Yes only if evidence exists |  |  |  |  |

