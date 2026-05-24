# גן בטוח

מערכת Production-ready לניהול, בקרה ופיקוח על גני ילדים פרטיים בישראל.

הפרויקט בנוי כארכיטקטורת Production:

- Next.js App Router
- React
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Row Level Security
- RBAC לפי תפקידים
- API Routes
- דשבורדים מוגנים
- סכמת DB מלאה

## תפקידי משתמש

- `admin` - אדמין ראשי
- `inspector` - פקח
- `manager` - גננת / מנהל גן
- `staff` - צוות גן
- `parent` - הורה

## ישויות מסד הנתונים

ה-migration יוצר:

- `gardens`
- `children`
- `parents`
- `teachers`
- `staff`
- `inspectors`
- `tasks`
- `inspections`
- `inspection_forms`
- `inspection_form_questions`
- `inspection_answers`
- `violations`
- `messages`
- `complaints`
- `leads`
- `documents`
- `attendance`
- `camera_streams`
- `camera_view_logs`
- `ai_events`
- `audit_logs`
- `profiles`

## התקנה

```bash
npm install
cp .env.example .env.local
npm run dev
```

עדכן ב-`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=
AI_OBSERVER_SECRET=
VIDEO_GATEWAY_URL=
VIDEO_GATEWAY_SIGNING_SECRET=
FIELD_ENCRYPTION_KEY=
```

## Supabase

1. צור פרויקט Supabase.
2. הרץ את כל קבצי ה-SQL לפי הסדר:

```text
supabase/migrations/20260523000000_initial_schema.sql
supabase/migrations/20260523001000_production_engines.sql
supabase/migrations/20260523002000_complete_operational_modules.sql
```

אפשר דרך Supabase SQL Editor או דרך Supabase CLI:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

3. צור משתמש ראשון ב-Supabase Auth.
4. עדכן אותו לאדמין:

```sql
update public.profiles
set role = 'admin', full_name = 'אדמין ראשי', must_change_password = false
where id = '<auth-user-id>';
```

## API Routes

- `GET/POST /api/gardens`
- `GET/POST /api/children`
- `GET/POST /api/parents`
- `GET/POST /api/teachers`
- `GET/POST /api/staff`
- `GET/POST /api/inspectors`
- `GET/POST /api/tasks`
- `GET/POST /api/inspections`
- `GET/POST /api/inspection-forms`
- `GET/POST /api/inspection-form-questions`
- `GET/POST /api/violations`
- `GET/POST /api/messages`
- `GET/POST /api/complaints`
- `GET/POST /api/leads`
- `GET/POST /api/documents`
- `GET/POST /api/attendance`
- `GET/POST /api/camera-streams`
- `GET/POST /api/ai-events`
- `GET/POST /api/audit-logs`
- `POST /api/admin/create-garden-manager`
- `POST /api/cron/monthly-inspections`
- `POST /api/inspections/:id/submit`
- `POST /api/camera-streams/:id/playback-token`
- `PATCH /api/camera-streams/:id/view-logs`
- `POST /api/ai/observe`
- `GET/POST /api/parent-camera-permissions`
- `GET/POST /api/camera-snapshots`
- `GET/POST /api/restricted-areas`
- `GET/POST /api/ai-alerts`
- `GET/POST /api/video-stream-sessions`
- `GET /api/unsafe-gardens`
- `POST /api/cron/inspection-reminders`
- `POST /api/tasks/:id/view`
- `POST /api/tasks/:id/escalate`
- `GET/POST /api/admin/procedures`
- `GET/POST /api/admin/campaigns`
- `GET/POST /api/admin/reports`
- `POST /api/admin/push-notices`
- `POST /api/admin/emergency-tasks`
- `GET/POST /api/staff/shifts`
- `GET/POST /api/staff/certificates`
- `POST /api/staff/gps-attendance`
- `POST /api/video-gateway/onvif-discovery`
- `POST /api/video-gateway/rtsp-ingest`
- `POST /api/video-gateway/dvr-connections`
- `POST /api/video-gateway/health-checks`
- Parent APIs under `/api/parent/*`: profile, messages, complaints, inspector contact, cameras, pickup, notifications, timeline, medical, gallery, schedule, attendance.

## מודולים תפעוליים מלאים

ה-migration השלישי מוסיף:

- `notifications` להתראות מערכת, הורים, צוות ופקחים.
- `task_view_logs` למעקב מי צפה במשימה ומתי.
- `mandatory_procedures` ו-`procedure_acknowledgements` לנהלים מחייבים.
- `campaigns` להודעות וקמפיינים תפעוליים.
- `report_exports` לייצוא דוחות.
- `staff_certificates` ו-`staff_shifts` לניהול צוות, תעודות, GPS ושעות.
- `gallery_items`, `schedule_items`, `medical_events`, `pickup_confirmations` לאזור ההורה.
- `video_gateway_connections` ו-`stream_health_checks` לחיבור DVR/NVR/ONVIF ולבדיקות תקינות סטרים.

## דשבורדים

- `/dashboard/admin`
- `/dashboard/inspector`
- `/dashboard/garden`
- `/dashboard/staff`
- `/dashboard/parent`

כל דשבורד מוגן דרך Supabase Auth ו-RBAC.

## הערת ציות

המערכת כוללת מבנה ציות תפעולי לגנים פרטיים ומעונות יום בישראל: מסמכים, מצלמות, פרטיות, בדיקות רקע, נוכחות, תלונות, פיקוח וליקויים. יש לאמת כל דרישת דין מול יועץ משפטי והרשות המוסמכת לפני שימוש מסחרי.

## מנוע פיקוח חודשי

ה-migration השני מוסיף:

- `create_monthly_inspection_tasks`
- `submit_inspection_with_answers`
- `unsafe_gardens`

יצירת משימות ביקורת חודשיות:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/cron/monthly-inspections" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{"month":"2026-06-01"}'
```

תזכורות ואיחורים:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/cron/inspection-reminders" \
  -H "x-cron-secret: $CRON_SECRET"
```

המערכת שולחת תזכורות אוטומטיות 7 ימים, 3 ימים ו-24 שעות לפני מועד הביקורת, ומסמנת משימות באיחור כ-`overdue`.

סיום ביקורת:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/inspections/<inspection-id>/submit" \
  -H "content-type: application/json" \
  -d '{
    "gps_lat": 32.0853,
    "gps_lng": 34.7818,
    "gps_radius_meters": 120,
    "answers": [
      { "question_id": "<question-id>", "score": 4, "note": "דורש תיקון" }
    ]
  }'
```

חוקים:

- כל שאלה מקבלת ציון 1-10.
- הציון מחושב כממוצע משוקלל לפי `inspection_form_questions.weight`.
- ציון 1-4 יוצר `violations` ומשימת תיקון.
- שאלה קריטית שנכשלה נספרת ככשל קריטי.
- ממוצע מתחת ל-8 או כשל קריטי מעדכן את `gardens.safe_status` ל-`requires_fix`.
- לפני submit נדרשת בדיקת GPS מול מיקום הגן, אלא אם אדמין אישר חריגה.

## שכבת וידאו ומצלמות

המערכת אינה חושפת RTSP/DVR להורים. המבנה:

```text
DVR/NVR/IP Camera -> RTSP/ONVIF -> Video Gateway -> HLS/WebRTC -> App token
```

הרשאות צפייה נשמרות ב-`parent_camera_permissions`.
כל צפייה מייצרת:

- `video_stream_sessions`
- `camera_view_logs`

קבלת token זמני:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/camera-streams/<camera-id>/playback-token" \
  -H "content-type: application/json" \
  -d '{ "protocol": "HLS", "parent_id": "<parent-id>" }'
```

חיבור RTSP:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/video-gateway/rtsp-ingest" \
  -H "content-type: application/json" \
  -d '{
    "garden_id": "<garden-id>",
    "name": "כיתה בוגרים",
    "area": "classroom",
    "rtsp_url": "rtsp://internal-camera-url"
  }'
```

בדיקת בריאות סטרים:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/video-gateway/health-checks" \
  -H "x-video-gateway-secret: $VIDEO_GATEWAY_SIGNING_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "garden_id": "<garden-id>",
    "camera_stream_id": "<camera-id>",
    "black_screen": false,
    "frozen": false,
    "offline": false,
    "covered": false,
    "latency_ms": 420
  }'
```

## תצפיתן AI

מנוע AI חיצוני מדווח למערכת דרך:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/ai/observe" \
  -H "x-ai-observer-secret: $AI_OBSERVER_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "garden_id": "<garden-id>",
    "camera_stream_id": "<camera-id>",
    "event_type": "violence_detection",
    "confidence": 0.91,
    "snapshot_storage_path": "garden/camera/frame.jpg",
    "metadata": { "model": "external-video-ai" }
  }'
```

אירועים נתמכים:

- `violence_detection`
- `child_alone_detection`
- `restricted_area_detection`
- `cry_detection`
- `staff_absence_detection`
- `child_outside_allowed_zone`
- `fall_detection`
- `crowding_detection`
- `overcrowding_detection`
- `sleeping_anomaly`
- `no_movement`
- `panic_movement`
- `camera_covered`
- `camera_disconnected`

כל אירוע יכול ליצור:

- `camera_snapshots`
- `ai_events`
- `ai_alerts`
- `incident_timeline`
- משימת טיפול במקרה קריטי

ה-migration יוצר גם bucket פרטי בשם `camera-snapshots` לאחסון תמונות אירוע.

## Admin Provisioning Environment Variables

`SUPABASE_SERVICE_ROLE_KEY` is required on the server for production admin provisioning flows on Vercel:

- creating Supabase Auth users
- converting kindergarten leads into active kindergartens
- creating kindergarten managers and optional owners
- converting inspector leads into active inspectors
- creating inspector users

Add it in Vercel Project Settings -> Environment Variables. Never expose it to the browser and never prefix it with `NEXT_PUBLIC_`.

If this key is missing, the UI shows a clear setup warning and the server logs the technical error. Lead conversion opens a completion wizard first and does not create partial users or kindergartens until the admin confirms the final form.

## Video Gateway / AI Gateway Limitation

The platform supports DVR/NVR/IP Camera/RTSP/ONVIF camera registration and secure browser playback through a Video Gateway:

RTSP/ONVIF -> HLS/WebRTC -> secure browser playback.

A real `VIDEO_GATEWAY_URL` server is required for live streaming and AI analysis. Until the gateway is connected, cameras can be saved as pending and configured, but live stream playback and live AI analysis remain pending. `AI_GATEWAY_URL` can be added when the AI backend is available.
