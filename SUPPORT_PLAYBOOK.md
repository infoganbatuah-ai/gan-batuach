# Gan Batuach Support Playbook

Use this playbook during the first pilot. Keep responses calm, practical and non-technical for customers.

## Support Triage

For every issue, capture:

- User name
- Role: parent, manager, owner, staff, inspector, admin
- Kindergarten name
- Child name if relevant
- Page URL
- What the user expected
- What actually happened
- Screenshot if possible
- Time of issue

Do not ask users for passwords. Do not request service role keys or private tokens in chat.

## Login Issues

Symptoms:

- User cannot log in.
- Login redirects to wrong dashboard.
- User sees empty dashboard.

Checks:

- Confirm email/username.
- Confirm user exists in Supabase Auth.
- Confirm matching `profiles` row exists.
- Confirm `profiles.role` is correct.
- Confirm user is linked to kindergarten/child/staff record where needed.
- Confirm account is active.

Actions:

- If password is unknown, send/reset password.
- If role is wrong, correct profile role.
- If dashboard is empty, check kindergarten/child/staff linkage.

Customer wording:

> בדקנו את החשבון ונעדכן את השיוך כדי שהדשבורד הנכון ייפתח.

## Password Reset

Checks:

- User email exists.
- Generated credentials exist if user was created by manager/admin.
- Temporary password status is clear.

Actions:

- Use reset password action if implemented.
- If temporary password is still valid, resend securely according to pilot policy.
- If parent changed password, do not show temporary password again.

Customer wording:

> נשלח לך קישור/פרטי התחברות חדשים. לאחר הכניסה מומלץ להחליף סיסמה.

## Parent Onboarding Issues

Symptoms:

- Parent sees blank form for existing child.
- Parent cannot submit child completion.
- Parent is asked for duplicate details.
- Child remains pending.

Checks:

- Child exists.
- Child status:
  - `pending_parent_completion`
  - `pending_manager_approval`
  - `active`
  - `missing_info`
- Parent is linked to child.
- Required photos exist:
  - child photo
  - at least one parent photo
- Required approvals are checked.
- Documents are required only if kindergarten requested them.

Actions:

- If parent-child link is missing, link safely.
- If child is already submitted, direct parent to status screen.
- If manager must approve, notify manager.

Customer wording:

> הפרטים נשמרו. אם הילד ממתין לאישור, הגן צריך לבצע אישור סופי לפני שהילד יופיע כפעיל.

## Child Approval Issues

Symptoms:

- Manager approved child but child still pending.
- Child does not appear in active list.
- Parent not notified.

Checks:

- Child `status`.
- Enrollment status if child-kindergarten enrollments are used.
- Manager garden id matches child garden id.
- Notification created for parent.
- No partial failed update in logs.

Actions:

- Re-run approval only if data is still pending.
- If child is active but list filter is wrong, clear filters.
- If notification failed, create/send follow-up notification.

Customer wording:

> הילד אושר במערכת. נבדוק שהרשימה וההתראה עודכנו כמו שצריך.

## Upload Issues

Symptoms:

- Photo upload fails.
- Document upload fails.
- Uploaded image does not appear.

Checks:

- User is logged in.
- Upload bucket exists.
- Bucket is allowed for user's role.
- File type is allowed.
- File size is reasonable.
- `SUPABASE_SERVICE_ROLE_KEY` exists server-side.
- Storage policies are active.

Actions:

- Ask user to retry with JPG/PNG/PDF depending on upload type.
- Check `/api/storage/upload` logs.
- Verify signed URL/path saved to correct record.

Customer wording:

> נראה שהקובץ לא עלה בצורה מלאה. ננסה שוב עם קובץ תמונה/מסמך תקין ונבדוק שהשמירה נקלטה.

## Notification Issues

Symptoms:

- User does not see notification.
- Unread count is wrong.
- Notification link opens wrong place.

Checks:

- Notification `recipient_profile_id`.
- Notification `recipient_role`.
- `action_url`.
- Status: unread/read/archived.
- User role and kindergarten/child relation.

Actions:

- Correct recipient if routing was wrong.
- Mark read/unread if count is stale.
- Fix action URL if it points to a generic or wrong page.

Customer wording:

> ההתראה אמורה להוביל ישירות למסך הרלוונטי. נבדוק את הקישור ונעדכן.

## Camera Issues

Symptoms:

- Parent cannot see camera.
- Parent sees waiting state.
- Playback button disabled.

Checks:

- Parent linked to kindergarten.
- Camera linked to same kindergarten.
- Parent viewing enabled.
- Camera active/status allows listing.
- Playback source exists:
  - sample HLS
  - HLS playback URL
  - WebRTC playback URL
  - gateway stream id
- Playback token route rechecks permission.

Actions:

- If no playback source, tell user camera is authorized but waiting for connection.
- If permission mismatch, correct camera/kindergarten/parent link.
- Do not expose RTSP, gateway ids or credentials to parents.

Customer wording:

> ההרשאה קיימת, אבל מקור השידור עדיין לא מחובר. כשהחיבור יושלם, כפתור הצפייה יופעל.

## Finance Issues

Symptoms:

- Finance page warning appears.
- Payment status wrong.
- Parent sees wrong payment.

Checks:

- Child belongs to kindergarten.
- Fee group exists.
- Payment status value is supported.
- Payment history loaded or optional warning is shown.
- Filter is correct: failed, overdue, due, partial, paused, not_transferred.

Actions:

- Correct child fee group.
- Update payment status.
- Check warning details in admin/server logs if secondary finance data failed.

Customer wording:

> נבדוק את שיוך התשלום והסטטוס. אם חסר מידע משני, הדף עדיין אמור להציג את הנתונים המרכזיים.

## Escalation

Escalate to engineering when:

- User sees global crash page.
- Role can access another role's/private data.
- Upload exposes private file.
- Parent sees another child.
- Manager sees another kindergarten.
- Camera secret or RTSP appears in UI.
- Payment/child approval reports success but database did not change.

Mark severity:

- Critical: privacy/security/data loss/global outage
- High: major flow blocked
- Medium: workaround exists
- Low: copy/design/minor confusion
