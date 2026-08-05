# תבנית לשליחה חזרה ל-Codex

העתק את הטקסט הזה, מלא אותו, ושלח ל-Codex כדי להריץ PILOT QA 2.

## גרסה קצרה מומלצת

אם אין לך כוח למלא את כל הטבלה, מלא רק את זה:

```text
אני רוצה להריץ PILOT QA 2 עם המידע הבא:

1. Supabase/RLS:
- בדקתי בסופאבייס: yes/no
- Parent A לא רואה Child B: pass/fail/not tested
- Manager A לא רואה Kindergarten B: pass/fail/not tested
- Staff לא משויך חסום: pass/fail/not tested
- Inspector לא משויך חסום: pass/fail/not tested

2. סביבה:
- שם פרויקט Supabase:
- סוג סביבה: demo/staging/pilot/production/unknown
- אין נתוני ילדים אמיתיים: yes/no
- אין נתוני הורים אמיתיים: yes/no

3. פיצ'רים מסוכנים:
- תשלומים חיים כבויים: yes/no/unknown
- צפיית הורים במצלמות כבויה: yes/no/unknown
- AI חי כבוי: yes/no/unknown
- SMS/WhatsApp חיים כבויים: yes/no/unknown

4. תמיכה:
- יש אחראי פיילוט ותמיכה: yes/no
- שם ופרטי קשר:

5. משפטי/פרטיות:
- עבר סקירה משפטית: yes/no
- או דניאל מקבל סיכון לפיילוט מוגבל: yes/no

6. בדיקה ויזואלית:
- בדקתי בדסקטופ ומובייל: yes/no
- בעיות שמצאתי:

7. החלטה:
- אני מבקש מ-Codex להריץ PILOT QA 2 עכשיו: yes/no
```

אם רוב התשובות הן `not tested` או `unknown`, Codex עדיין יכול להכין PILOT QA 2, אבל לא יוכל לאשר פיילוט אמיתי.

## גרסה מלאה

```text
Supabase/RLS:
- Status: PASS / FAIL / BLOCKED
- Failed tests:
- Evidence:

Environment:
- Status: PASS / FAIL / BLOCKED
- Supabase project:
- Vercel environment:
- Real child data allowed: yes/no
- Real parent data allowed: yes/no
- Live payments disabled: yes/no
- Parent camera viewing disabled: yes/no
- Live AI disabled: yes/no
- Production SMS/WhatsApp disabled: yes/no

Role A/B:
- Status: PASS / FAIL / BLOCKED
- Failed tests:
- Evidence:

Support:
- Owner assigned: yes/no
- Owner name/contact:
- Backup owner:

Visual:
- Status: PASS / FAIL / BLOCKED
- Failed routes/viewports:
- Evidence:

Legal/privacy:
- Status: reviewed / risk accepted / blocked
- Reviewer or signer:
- Evidence:

Native/mobile:
- Included in pilot: yes/no
- Real device tested: yes/no
- Evidence:

Final:
- I want Codex to run PILOT QA 2: yes/no
- Notes:
```
