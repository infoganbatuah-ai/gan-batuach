# DEMO AUTH CREDENTIALS 1 - Missing Users Completion Plan

Focus accounts:

- Parent unassigned
- Staff unassigned
- Inspector unassigned
- Digital Observer authenticated user

## Parent Unassigned

### Option A - Manual Supabase Dashboard Creation

1. פתח את Supabase בפרויקט הדמו/פיילוט הבטוח.
2. עבור אל Authentication -> Users.
3. צור משתמש עם אימייל דמו, למשל `qa.parent.unassigned@demo.ganbatuach.com`.
4. הגדר סיסמה זמנית ידנית. לא להכניס אותה לדוחות.
5. אשר את האימייל.
6. בטבלת `profiles`, צור/עדכן שורה עם אותו `id`.
7. הגדר `role = parent`.
8. הגדר `active = true`.
9. אל תיצור רשומת `parents` שמקשרת אותו לילד.
10. אל תשייך אותו לגן.
11. ודא שהכניסה מובילה למצב הורה ללא ילדים/בקשות, ולא מציגה נתוני ילד.

### Option B - Safe Script

Fill `QA_DEMO_PARENT_UNASSIGNED_PASSWORD` in `.env.qa-demo.local`, then run:

```bash
npm run qa:create-demo-role-users
```

The script uses synthetic users only and does not print passwords.

## Staff Unassigned

### Option A - Manual Supabase Dashboard Creation

1. פתח את Supabase בפרויקט הדמו/פיילוט הבטוח.
2. עבור אל Authentication -> Users.
3. צור משתמש עם אימייל דמו, למשל `qa.staff.unassigned@demo.ganbatuach.com`.
4. הגדר סיסמה זמנית ידנית. לא להכניס אותה לדוחות.
5. אשר את האימייל.
6. בטבלת `profiles`, צור/עדכן שורה עם אותו `id`.
7. הגדר `role = staff`.
8. הגדר `active = true`.
9. אל תשייך `garden_id`.
10. אל תיצור רשומת staff פעילה שמשייכת אותו לגן.
11. ודא שהכניסה מובילה למצב "עדיין לא שובצת לגן".

### Option B - Safe Script

Fill `QA_DEMO_STAFF_UNASSIGNED_PASSWORD` in `.env.qa-demo.local`, then run:

```bash
npm run qa:create-demo-role-users
```

The script uses synthetic users only and does not print passwords.

## Inspector Unassigned

### Option A - Manual Supabase Dashboard Creation

1. צור משתמש Auth עם אימייל דמו, למשל `qa.inspector.unassigned@demo.ganbatuach.com`.
2. הגדר סיסמה זמנית ידנית.
3. צור/עדכן `profiles` עם `role = inspector`.
4. הגדר מצב שלא נותן גישה לגנים: `active = false` או ללא רשומת `inspectors`.
5. אל תשייך גנים.
6. ודא שהכניסה מובילה למסך בקשה/המתנה ולא לדשבורד עם גנים.

### Option B - Safe Script

Fill `QA_DEMO_INSPECTOR_UNASSIGNED_PASSWORD` in `.env.qa-demo.local`, then run:

```bash
npm run qa:create-demo-role-users
```

## Digital Observer Authenticated User

### Option A - Manual Supabase Dashboard Creation

1. צור משתמש Auth עם אימייל דמו, למשל `qa.digital.observer@demo.ganbatuach.com`.
2. הגדר סיסמה זמנית ידנית.
3. צור/עדכן `profiles` עם role קיים במערכת, מומלץ `network_manager` לצורך QA עד שיוגדר role נפרד.
4. צור אתר תצפית סינתטי בטבלת `observer_sites`.
5. צור שיוך בטבלת `observer_site_memberships` עם `member_role = owner`.
6. ודא שאין קשר לנתוני ילדים או גני Gan Batuach.
7. ודא שהכניסה ל-`/digital-observer/dashboard` מציגה אתר דמו בלבד.

### Option B - Safe Script

Fill `QA_DEMO_DIGITAL_OBSERVER_PASSWORD` in `.env.qa-demo.local`, then run:

```bash
npm run qa:create-demo-role-users
```

The script creates a synthetic Digital Observer site and membership when possible.

## Do Not

- Do not use real users.
- Do not use real children/parents.
- Do not upload real documents.
- Do not enable live payments, live cameras, live AI or production WhatsApp/SMS.
- Do not commit passwords.
