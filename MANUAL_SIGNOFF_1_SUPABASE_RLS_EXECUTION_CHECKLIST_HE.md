# MANUAL SIGNOFF 1 - צ'קליסט ביצוע Supabase/RLS

תאריך: 2026-07-12

## כלל ברזל

אין להשתמש בנתוני ילדים אמיתיים, הורים אמיתיים או מסמכים אמיתיים בבדיקות האלה.

## A. אישור סביבה

- [ ] אישרתי שזה פרויקט Supabase הנכון.
- [ ] סימנתי האם זו סביבת demo / staging / pilot / production: __________
- [ ] רשמתי Project name: __________
- [ ] רשמתי Project ID/ref: __________
- [ ] וידאתי שהמיגרציות האחרונות הוחלו.
- [ ] וידאתי שאין נתוני ילדים אמיתיים בבדיקות.
- [ ] תאריך הבדיקה: __________
- [ ] שם הבודק: __________

## B. חשבונות סינתטיים נדרשים

- [ ] admin_test
- [ ] manager_a_test
- [ ] manager_b_test
- [ ] parent_a_test
- [ ] parent_b_test
- [ ] staff_unassigned_test
- [ ] staff_assigned_a_test
- [ ] inspector_unassigned_test
- [ ] inspector_assigned_a_test

## C. נתונים סינתטיים נדרשים

- [ ] Kindergarten A
- [ ] Kindergarten B
- [ ] Child A linked to Parent A
- [ ] Child B linked to Parent B
- [ ] Staff assigned to Kindergarten A only
- [ ] Inspector assigned to Kindergarten A only
- [ ] Payment/subscription record for Kindergarten A
- [ ] Camera readiness record for Kindergarten A
- [ ] AI event/readiness record for Kindergarten A
- [ ] Private document record for Child A
- [ ] Private document record for Child B

## D. בדיקות RLS חובה

| Test ID | איך לבדוק | Expected result | Actual result | Pass/Fail | Screenshot/evidence | Notes |
|---|---|---|---|---|---|---|
| RLS-01 | התחבר כ-Parent A ופתח Child A | Parent A can see Child A |  |  |  |  |
| RLS-02 | התחבר כ-Parent A ונסה לפתוח Child B | Parent A cannot see Child B |  |  |  |  |
| RLS-03 | התחבר כ-Parent A ונסה לשלוף/לראות רשימת כל הילדים | Parent A cannot list all children |  |  |  |  |
| RLS-04 | התחבר כ-Parent B ונסה לפתוח Child A | Parent B cannot see Child A |  |  |  |  |
| RLS-05 | התחבר כ-Manager A ופתח Kindergarten A | Manager A can see Kindergarten A |  |  |  |  |
| RLS-06 | התחבר כ-Manager A ונסה לפתוח Kindergarten B | Manager A cannot see Kindergarten B |  |  |  |  |
| RLS-07 | התחבר כ-Manager B ונסה לפתוח Kindergarten A | Manager B cannot see Kindergarten A |  |  |  |  |
| RLS-08 | התחבר כ-Staff unassigned ונסה לראות ילדים/הורים | Staff unassigned cannot see children/parents |  |  |  |  |
| RLS-09 | התחבר כ-Staff assigned A ונסה לפתוח Kindergarten B | Staff assigned A cannot see Kindergarten B |  |  |  |  |
| RLS-10 | התחבר כ-Inspector unassigned ונסה לראות גנים | Inspector unassigned cannot see gardens |  |  |  |  |
| RLS-11 | התחבר כ-Inspector assigned A ונסה לפתוח Kindergarten B | Inspector assigned A cannot see Kindergarten B |  |  |  |  |
| RLS-12 | התחבר כהורה/צוות/מפקח ונסה לראות provider/payment records | parent/staff/inspector cannot see provider/payment records |  |  |  |  |
| RLS-13 | התחבר כהורה ונסה לראות raw AI | parent cannot see raw AI |  |  |  |  |
| RLS-14 | התחבר בתפקיד client ונסה לראות camera credentials | any client role cannot see camera credentials |  |  |  |  |
| RLS-15 | נסה לפתוח private document ללא הרשאה | sensitive documents are private |  |  |  |  |
| RLS-16 | צור Signed URL למסמך רגיש ובדוק TTL | signed URLs are short-lived |  |  |  |  |

## החלטת RLS

- [ ] signed_off
- [ ] failed
- [ ] blocked
- [ ] needs_fix

אם לא סומן signed_off, אסור להתחיל פיילוט עם הורים/ילדים אמיתיים.
