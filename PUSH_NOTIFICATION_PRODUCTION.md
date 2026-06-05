# Push Notification Production Readiness

Gan Batuach now has a production-ready push notification architecture for Web, Android and iOS, while real delivery remains intentionally disabled.

## Goal

- Use one provider abstraction for Firebase Cloud Messaging, Apple Push Notification Service and Web Push.
- Keep provider keys server-only.
- Track device tokens, template usage, delivery status, failures, opens and retry readiness.
- Support role-aware notification preferences.
- Prepare deep links so each notification can open the exact relevant screen.
- Avoid real push delivery until production credentials, webhooks and operational approval are complete.

## Provider Architecture

Provider code lives in:

- `lib/domain/push-provider.ts`
- `lib/domain/push-service.ts`

Supported providers:

- `mock_push`
- `fcm`
- `apns`
- `web_push`
- `custom`

Current behavior:

- `mock_push` is the default.
- FCM/APNs/Web Push can report readiness when env vars exist.
- Real sends are blocked unless a future implementation explicitly enables them.
- The admin dashboard shows missing provider configuration without exposing secrets.

## Environment Variables

Server-only unless noted:

- `PUSH_PROVIDER`
- `PUSH_REAL_SEND_ENABLED=false`
- `FCM_SERVER_KEY`
- `FCM_PROJECT_ID`
- `FCM_SERVICE_ACCOUNT_JSON`
- `APNS_KEY_ID`
- `APNS_TEAM_ID`
- `APNS_BUNDLE_ID`
- `APNS_PRIVATE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `PUSH_PROVIDER_ENDPOINT`
- `PUSH_PROVIDER_API_KEY`

`VAPID_PUBLIC_KEY` may be exposed later only through a safe client config endpoint.

## Data Model

Existing foundation:

- `push_device_tokens`
- `push_notification_logs`

Production readiness additions:

- `push_templates`
- `push_category_preferences`
- `push_provider_configs`

`push_device_tokens` now supports:

- active and disabled devices
- revoked tokens
- disabled reasons
- token hash for duplicate cleanup
- provider tracking
- last error

`push_notification_logs` now supports:

- queued
- sent
- delivered
- opened
- failed
- dead letter
- provider references
- template references
- categories
- retry attempts
- next retry time
- deep link type

## Templates

Seeded template categories:

- registration
- parent approval
- child approval
- payment reminders
- safety alerts
- observer alerts
- inspection alerts
- camera alerts
- system notifications

Templates store:

- `template_name`
- `category`
- `language`
- `variables`
- `status`
- title/body templates
- default action route
- default deep link type

## Deep Linking

Prepared deep link targets:

- child profile
- camera
- incident
- payment
- inspection
- observer event
- system dashboard

The app should continue using safe internal routes only. External links should be added through a reviewed allowlist if needed.

## Preferences

Push preferences are layered:

- global push preference in `communication_preferences`
- critical push allowance
- per-category preferences in `push_category_preferences`
- role metadata for future role-specific defaults

Critical notifications can remain enabled where legally and operationally permitted.

## Admin Dashboard

Route:

- `/dashboard/admin/push-production`

Shows:

- provider status
- template status
- active and disabled devices
- delivery metrics
- failures
- opened notifications
- retry readiness
- deep link readiness

## Real Delivery Policy

Real push delivery is not enabled in this phase.

Before enabling:

1. Add real FCM/APNs/Web Push send adapters.
2. Configure production credentials.
3. Add provider delivery/open webhooks.
4. Verify token cleanup and unsubscribe flows.
5. Verify category preferences.
6. Run role-based permission tests.
7. Enable `PUSH_REAL_SEND_ENABLED` only after pilot approval.

## Testing Checklist

- Register mock Web/Android/iOS token.
- Register duplicate token and verify it updates existing row.
- Unregister token and verify it is inactive/revoked.
- Create push preparation from a notification.
- Verify log contains template/category/deep link metadata.
- Verify admin sees devices and logs.
- Verify category preferences can skip non-critical notifications.
- Verify no real provider is called without explicit production implementation.
