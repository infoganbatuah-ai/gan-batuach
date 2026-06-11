# Unified Communications & Messaging Network

## Purpose

Gan Batuach now has a unified communication command center:

`/dashboard/admin/communications`

It brings together in-app messaging, email, SMS, WhatsApp and push notifications into one operational network. The goal is one conversation layer with multiple delivery channels, not separate communication systems.

## Communication Model

The additive database layer introduces:

- `communication_threads`
- `communication_thread_participants`
- `communication_delivery_events`

Existing `messages`, `notifications`, provider logs and parent requests remain the operational sources. The thread model sits above them and links future communication to one unified conversation.

Supported thread types:

- parent-kindergarten
- parent-manager
- staff-manager
- inspector-kindergarten
- admin-user
- complaint
- inspection
- document request
- emergency
- general

## Routing Model

Each thread can carry:

- recipient scope
- role participants
- priority
- delivery channels
- status
- linked garden, child, complaint or inspection

Supported priorities:

- informational
- important
- urgent
- critical

Routing is advisory in this phase. Automated broad sending is not enabled.

## Notification Model

Delivery can use:

- in-app
- email
- SMS
- WhatsApp
- push

The command center displays delivery status, failures, channel health and templates. Real sending remains controlled by provider activation and safe test flows.

## Privacy Model

Communication access must follow role boundaries:

- parents see only their own child/family conversations
- staff see their assigned kindergarten/team messages
- managers see their kindergarten communication
- inspectors see assigned kindergarten inspection/complaint communication
- admins see the full platform

Delivery logs must not expose secrets, passwords, provider tokens or sensitive camera/observer data.

## Escalation Model

Urgent and critical communication can be routed through multiple channels, but human approval remains required for sensitive communication.

Escalation examples:

- emergency notice
- safety alert
- inspection notice
- compliance alert
- document reminder
- payment reminder
- complaint follow-up

## AI Communication Assistant

Assistant capabilities should remain human-reviewed:

- summarize conversation
- suggest response
- classify message
- prioritize communication
- detect unresolved request

The assistant must not send messages automatically.

## Analytics Model

The command center tracks:

- active conversations
- pending messages
- unread messages
- delivery failures
- channel readiness
- response rate
- template readiness
- safe test logs

Future analytics can expand into open rates, response SLA and channel performance per role.

## Remaining Gaps

- Role-specific unified inbox pages should eventually replace the older separate message pages.
- Real conversation creation should write directly to `communication_threads`.
- Delivery events should be written by every send provider, not only readiness/test flows.
- Communication preferences per notification type need a dedicated user-facing editor.
- Emergency multi-channel send must stay gated by approval and provider activation.
