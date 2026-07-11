# PILOT BLOCKER FIX 1 - חבילת אישור ידני Supabase/RLS

תאריך: 2026-07-12

## מטרה

לאשר ידנית, בסביבת Supabase האמיתית שמיועדת לפיילוט, שכל תפקיד רואה רק את המידע שמותר לו לראות.

אסור להשתמש בנתוני ילדים אמיתיים בבדיקה הזו.

## 1. בחירת סביבת בדיקה

1. פתח את Supabase.
2. ודא שאתה נמצא בפרויקט שמיועד ל-Staging/Pilot ולא ב-Demo ולא ב-Production.
3. רשום:
   - שם הפרויקט
   - Project ref
   - תאריך ושעה
   - מי ביצע את הבדיקה
4. ודא שאין בפרויקט הזה נתוני ילדים/הורים אמיתיים לפני תחילת הבדיקה.

## 2. אימות מיגרציות

1. פתח SQL Editor או Supabase CLI.
2. בדוק שטבלאות ומדיניות RLS קיימות עבור:
   - profiles/users
   - kindergartens
   - children
   - parent-child links
   - staff assignments
   - inspector assignments
   - documents/storage
   - payment/provider records
   - camera records/tokens
   - AI events/review queue
3. השווה מול קבצי המיגרציה המקומיים.
4. אם חסרה מיגרציה - עצור וסמן FAIL.

## 3. משתמשים סינתטיים נדרשים

צור או ודא משתמשי בדיקה בלבד:

- admin_test
- manager_a_test
- manager_b_test
- parent_a_test
- parent_b_test
- staff_unassigned_test
- staff_assigned_a_test
- inspector_unassigned_test
- inspector_assigned_a_test

אין להשתמש במיילים/טלפונים אמיתיים של הורים או ילדים.

## 4. נתוני בדיקה סינתטיים

צור:

- Kindergarten A
- Kindergarten B
- Child A מקושר ל-Parent A ול-Kindergarten A
- Child B מקושר ל-Parent B ול-Kindergarten B
- Staff Assigned A מקושר רק ל-Kindergarten A
- Inspector Assigned A מקושר רק ל-Kindergarten A
- מסמך סינתטי ל-Child A
- מסמך סינתטי ל-Child B
- רשומת Subscription/Payment ל-Kindergarten A
- רשומת Camera ל-Kindergarten A ללא credentials אמיתיים
- רשומת AI Event סינתטית ל-Kindergarten A

## 5. בדיקות Parent A / Parent B

סמן PASS רק אם:

- Parent A רואה את Child A.
- Parent A לא רואה את Child B.
- Parent A לא יכול לשלוף את כל ילדי Kindergarten A.
- Parent B לא רואה את Child A.
- Parent A לא רואה פרופיל Parent B.
- Parent A לא רואה רשומות ספק/תשלום של הגן.
- Parent A לא רואה raw AI events.
- Parent A לא רואה camera credentials.
- Parent A לא מקבל Signed URL למסמך של Child B.

## 6. בדיקות Manager A / Manager B

סמן PASS רק אם:

- Manager A רואה רק את Kindergarten A.
- Manager A לא רואה Kindergarten B.
- Manager A לא רואה Child B.
- Manager A לא רואה Staff/Parent לא קשורים.
- Manager A לא רואה provider webhook events.
- Manager A לא רואה RTSP, camera password, gateway secret או AI provider secret.

## 7. בדיקות Staff

Staff unassigned:

- לא רואה ילדים.
- לא רואה הורים.
- לא רואה מסמכים.
- לא רואה Attendance.
- לא רואה Camera/AI פנימי.

Staff assigned A:

- רואה רק context עבודה של Kindergarten A.
- לא רואה Kindergarten B.
- לא רואה Child B.
- לא רואה payment/provider records.

## 8. בדיקות Inspector

Inspector unassigned:

- לא רואה גנים.
- לא רואה ילדים.
- לא רואה דוחות/ראיות.

Inspector assigned A:

- רואה רק Kindergarten A.
- לא רואה Kindergarten B.
- לא רואה provider/payment records.
- לא רואה raw camera credentials.
- לא רואה raw AI provider data.

## 9. בדיקות Provider / Payment

ודא:

- Parent/Staff/Inspector לא רואים payment/provider records.
- Manager A רואה רק subscription state של Kindergarten A.
- Manager A לא רואה subscription של Kindergarten B.
- Admin רואה status ללא secrets.

## 10. בדיקות Camera

ודא:

- אף תפקיד Client לא רואה RTSP.
- אף תפקיד Client לא רואה camera username/password.
- Parent לא יכול לצפות במצלמה.
- Manager A לא יכול לגשת למצלמת Kindergarten B.
- Inspector unassigned לא יכול לגשת למצלמות.

## 11. בדיקות AI

ודא:

- Parent לא רואה raw AI.
- Parent לא רואה confidence scores.
- Parent לא רואה review queue.
- Manager A לא רואה AI events של Kindergarten B.
- Inspector assigned A לא רואה AI events של Kindergarten B.
- אין גישה ל-AI provider secrets.

## 12. בדיקות Storage / Signed URLs

ודא:

- Buckets רגישים הם private.
- Signed URL למסמכים רגישים קצר-זמן.
- User לא מורשה לא יכול ליצור Signed URL למסמך של משתמש/ילד אחר.
- Public assets לא מכילים מסמכים/תמונות רגישות.

## 13. תיעוד תוצאה

לכל בדיקה רשום:

- Test ID
- Role
- Object/data
- Expected
- Actual
- PASS/FAIL
- צילום מסך או SQL output ללא secrets
- תאריך ושעה
- שם הבודק

## החלטת שער

אם בדיקה אחת קריטית נכשלת - אין פיילוט אמיתי.

סטטוס עד לביצוע: **RLS_MANUAL_VERIFICATION_REQUIRED**.
