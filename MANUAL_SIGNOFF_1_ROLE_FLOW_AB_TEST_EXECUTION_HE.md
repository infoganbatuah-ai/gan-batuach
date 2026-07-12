# MANUAL SIGNOFF 1 - ביצוע בדיקות A/B לתפקידי פיילוט

תאריך: 2026-07-12

אין להשתמש בנתונים אמיתיים. כל הבדיקות חייבות לרוץ עם משתמשים ונתונים סינתטיים.

## Parent A / Parent B

| Test | Account used | Route/action | Expected result | Actual result | Pass/Fail | Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Parent A sees Child A |  |  | Parent A sees Child A |  |  |  |  |
| Parent A cannot see Child B |  |  | Access denied/not found |  |  |  |  |
| Parent B cannot see Child A |  |  | Access denied/not found |  |  |  |  |

## Manager A / Manager B

| Test | Account used | Route/action | Expected result | Actual result | Pass/Fail | Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Manager A sees Kindergarten A |  |  | Manager A sees own kindergarten |  |  |  |  |
| Manager A cannot see Kindergarten B |  |  | Access denied/not found |  |  |  |  |
| Manager B cannot see Kindergarten A |  |  | Access denied/not found |  |  |  |  |

## Staff

| Test | Account used | Route/action | Expected result | Actual result | Pass/Fail | Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Staff unassigned sees no children/parents |  |  | No child/parent records visible |  |  |  |  |
| Staff assigned A sees only allowed Kindergarten A context |  |  | Only permitted work context |  |  |  |  |
| Staff assigned A cannot see Kindergarten B |  |  | Access denied/not found |  |  |  |  |

## Inspector

| Test | Account used | Route/action | Expected result | Actual result | Pass/Fail | Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Inspector unassigned sees no gardens |  |  | No garden data visible |  |  |  |  |
| Inspector assigned A sees Kindergarten A |  |  | Assigned garden visible |  |  |  |  |
| Inspector assigned A cannot see Kindergarten B |  |  | Access denied/not found |  |  |  |  |

## Provider / Camera / AI

| Test | Account used | Route/action | Expected result | Actual result | Pass/Fail | Evidence | Notes |
|---|---|---|---|---|---|---|---|
| Parent/staff/inspector cannot see provider records |  |  | Access denied/not found |  |  |  |  |
| Parent cannot see raw AI |  |  | Raw AI not visible |  |  |  |  |
| User cannot see camera credentials |  |  | RTSP/credentials not visible |  |  |  |  |

## החלטה

- [ ] signed_off
- [ ] failed
- [ ] blocked
- [ ] needs_fix

אם יש FAIL בבדיקת בידוד תפקידים, אין פיילוט עם נתונים אמיתיים.
