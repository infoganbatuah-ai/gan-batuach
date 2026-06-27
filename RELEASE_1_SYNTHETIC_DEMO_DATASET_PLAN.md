# RELEASE 1 - Synthetic Demo Dataset Plan

Date: 2026-06-27

Do not seed production data unless explicitly authorized.

## Synthetic Entities

Admin:

- name: `אדמין דמו`
- email placeholder: `demo_admin_email`

Kindergarten:

- name: `גן הדגמה בטוח`
- city: `עיר דמו`
- address: `רחוב דמו 10`
- status: `demo_active` or `approved_pending_subscription`

Manager:

- name: `דנה מנהלת דמו`
- email placeholder: `demo_manager_email`

Parent:

- name: `נועה הורה דמו`
- email placeholder: `demo_parent_email`

Child:

- name: `ילד דמו`
- age group: `טרום חובה`
- medical notes: empty or `אין נתונים רפואיים בדמו`

Staff:

- name: `מיכל צוות דמו`
- email placeholder: `demo_staff_email`
- assignment: synthetic kindergarten only

Inspector:

- name: `רוני מפקח דמו`
- email placeholder: `demo_inspector_email`
- assignment: synthetic kindergarten only

Digital Observer:

- site name: `אתר תצפיתן דמו`
- camera state: readiness/mock only
- AI state: shadow/readiness only

## Demo Records

- one enrollment request
- one synthetic attendance day
- one daily schedule
- two synthetic messages
- one subscription readiness state
- one synthetic inspection
- one synthetic inspection report
- one camera readiness record
- one AI/shadow candidate event marked for internal review only

## Safety Rules

- no real child names
- no real parent names
- no real phone numbers
- no real sensitive documents
- no real medical data
- no real camera credentials
- no real provider secrets
- no real payment data

## Existing Scripts

Existing scripts such as `seed:demo-full` should be used only in a controlled demo environment after reviewing their dataset and target Supabase project.

dataset_status = plan_only
