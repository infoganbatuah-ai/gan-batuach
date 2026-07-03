# PILOT FIX 7 - AI Event Wording Validation

## Fixes Made

- Replaced active labels such as "זוהתה דמות לבדיקה" with "דמות אפשרית לבדיקה".
- Replaced "תנועה זוהתה לבדיקה" with "תנועה אפשרית לבדיקה".
- Replaced "מספר דמויות זוהו לבדיקה" with "מספר דמויות אפשריות לבדיקה".
- Replaced active safety title "אינדיקציה לאלימות - review דחוף" with "אינדיקציה לתנועה חריגה - review דחוף".

## Allowed Wording

- "אירוע חשוד לבדיקה"
- "נדרש בירור אנושי"
- "מועמד לאירוע חריג"
- "סימן אפשרי"
- "דורש סקירה"
- "חשד לנפילה"
- "חריגה מתנועה רגילה"
- "בעיה אפשרית בכיסוי מצלמה"

## Forbidden Wording

- "אלימות זוהתה"
- "התעללות זוהתה"
- "הזנחה זוהתה"
- "אירוע פלילי"
- "אישור אוטומטי"
- "המערכת קבעה"
- "ודאות"
- "הוכחה"

## Remaining Note

Some internal enum keys remain for compatibility, for example `violence_indicator`. They must be treated as internal technical identifiers, not parent/store/demo claims.

