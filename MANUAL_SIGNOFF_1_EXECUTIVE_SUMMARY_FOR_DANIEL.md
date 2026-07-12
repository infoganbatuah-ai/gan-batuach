# MANUAL SIGNOFF 1 - תקציר מנהלים לדניאל

תאריך: 2026-07-12

## למה צריך את הסבב הזה

PILOT BLOCKER QA 1 קבע שהמערכת מוכנה לסבב אישורים ידניים, אבל לא לפיילוט אמיתי.

הסיבה: החסמים הקריטיים והגבוהים לא נסגרו בקוד. הם דורשים הוכחות אמיתיות:

- בדיקות Supabase/RLS בסביבת הפיילוט.
- אישור משפטי/פרטיות או קבלת סיכון כתובה.
- אישור הפרדת סביבות.
- בדיקות A/B לתפקידים.
- מינוי בעלי תמיכה ואירועים.
- בדיקה ויזואלית ידנית.

## מה אתה צריך לעשות עכשיו

1. למלא את `MANUAL_SIGNOFF_1_REAL_PILOT_SIGNOFF_TRACKER.md`.
2. להריץ את `MANUAL_SIGNOFF_1_SUPABASE_RLS_EXECUTION_CHECKLIST_HE.md`.
3. למלא את `MANUAL_SIGNOFF_1_SUPABASE_RLS_SIGNOFF_RESULT_FORM.md`.
4. לשלוח את חבילת המשפטי/פרטיות לבדיקה או למלא Risk Acceptance.
5. לאשר את סביבת Supabase/Vercel בפועל.
6. להריץ את בדיקות A/B לתפקידים.
7. למנות בעלי תמיכה, אירועים ו-Rollback.
8. לבצע בדיקה ויזואלית ידנית.

## מה יכול להיחתם על ידך

- אישור סביבת פיילוט.
- קבלת סיכון אם בוחרים להתקדם בלי בדיקה משפטית מלאה.
- מינוי בעלי תמיכה ואירועים.
- החלטה שנייטיב/מובייל לא כלול בפיילוט הראשון.
- אישור שהפיילוט נשאר ללא מצלמות הורים, ללא AI חי וללא תשלומים חיים.

## מה צריך ללכת לעורך דין / בודק פרטיות

- Privacy Policy
- Terms of Use
- Child Data Notice
- Parent Consent
- Camera Notice
- AI Notice
- Data Retention
- Account Deletion
- Payment / Subscription Terms

## מה חייב להיבדק ב-Supabase

- Parent A לא רואה Child B.
- Manager A לא רואה Kindergarten B.
- Staff unassigned לא רואה ילדים/הורים.
- Inspector unassigned לא רואה גנים.
- הורה/צוות/מפקח לא רואים provider/payment records.
- הורה לא רואה raw AI.
- אף client role לא רואה camera credentials.
- מסמכים רגישים private ו-Signed URLs קצרי-זמן.

## מה עדיין חוסם ילדים/הורים אמיתיים

- RLS לא חתום.
- משפטי/פרטיות לא חתום.
- סביבת פיילוט לא חתומה.
- A/B role tests לא בוצעו.
- אין בעלי תמיכה/אירועים חתומים.

## מה חוסם מצלמות / AI

- צפיית הורים במצלמות נשארת כבויה.
- AI נשאר Shadow/Synthetic בלבד.
- צריך Token/Audit/Legal/RLS לפני כל שימוש אמיתי.

## מה חוסם מובייל / Native

אם הפיילוט כולל אפליקציה Native:

- צריך `npx cap sync`.
- צריך בדיקת Android/iOS.
- צריך בדיקת מכשיר אמיתי.

אם הפיילוט Web-only, זה לא חוסם.

## מה חוסם דמו חיצוני / Store

- בדיקה ויזואלית ידנית.
- Native/mobile validation אם רלוונטי.
- Legal/store/privacy consistency.

## מתי להריץ PILOT QA 2

רק אחרי שיש ראיות אמיתיות בטפסים:

- Supabase/RLS signed_off או failed.
- Legal reviewed או Daniel risk accepted.
- Environment signed_off.
- Role A/B tests completed.
- Support owners assigned.

לפני זה אין טעם להריץ PILOT QA 2.
