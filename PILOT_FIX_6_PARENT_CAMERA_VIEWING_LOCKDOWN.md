# PILOT FIX 6 - Parent Camera Viewing Lockdown

Date: 2026-07-03

## Default

Parent viewing is disabled by default.

This phase also locked the older camera wizard so it cannot set `parent_view_allowed` or `parent_viewing_allowed` to true from that UI.

## Parent Viewing Required Conditions

Parent may view only if all are true:

- `enable_parent_camera_view` is true.
- legal/privacy/camera notice is approved.
- parent accepted required notice/consent if implemented.
- parent has approved active relationship to child.
- child is linked to the specific kindergarten.
- child is currently checked in if policy requires.
- camera belongs to that kindergarten.
- camera is parent-visible.
- viewing is within allowed hours.
- kindergarten is active and not frozen/suspended if policy blocks it.
- tokenized viewing session is issued.
- audit event is created.
- no other child privacy issue exists.
- admin/manager policy allows the session.
- MFA/capability gate passes where required.

## Current Code Gate Evidence

- Parent token flow requires active `parent_camera_policies`.
- Parent token flow checks capability/legal/consent readiness.
- Parent token flow requires WebRTC.
- Parent token flow checks parent-child-kindergarten relationship.
- Parent token flow requires child checked in.
- Parent token flow checks camera room/class when configured.
- Playback URL validation rejects RTSP and private hosts.
- Tokens are short-lived and hashed in storage.

## Status

Parent viewing status: **LOCKED**

Recommendation: **CAMERA_PARENT_VIEW_BLOCKED_PENDING_LEGAL_RLS_TOKEN_AUDIT**
