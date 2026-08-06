# PRODUCT REALITY FIX 1 - Date / Time Fix Report

## New Helper

Created `lib/domain/israel-date.ts`.

It provides:

- `israelTodayDateParts()`
- `israelTodayDateLine()`

The helper formats:

- Israeli weekday
- Hebrew-calendar date
- Gregorian date
- `Asia/Jerusalem` timezone

## Files Updated

| File | Fix |
|---|---|
| `components/teacher-app-ui.tsx` | Shared teacher date pill now uses current Israel date. |
| `app/dashboard/garden/page.tsx` | Manager dashboard date and last-updated labels now reflect reality. |
| `app/dashboard/garden/attendance/page.tsx` | Attendance date pill now uses current Israel date. |

## Remaining

Authenticated QA should check whether other role dashboards have stale text that only appears for particular synthetic data states.
