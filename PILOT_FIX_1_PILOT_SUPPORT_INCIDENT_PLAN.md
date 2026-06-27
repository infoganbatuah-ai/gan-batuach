# PILOT FIX 1 - Pilot Support And Incident Plan

Date: 2026-06-27

## Minimum Support Before Pilot

Required:

- support contact for pilot participants
- named incident owner
- internal escalation channel
- privacy/security incident path
- payment/provider issue path if payments included
- camera/AI issue path if camera/AI included
- issue log
- rollback procedure

## Reporting Paths

Manager/staff/parent/inspector issue:

- report to pilot support contact
- log issue with role, route, time, description, screenshot if safe
- triage severity

Privacy/security incident:

- immediately suspend affected feature or account
- notify incident owner
- preserve logs
- do not export sensitive data into chat/tools

Camera/AI incident:

- disable camera/AI module or viewing
- preserve audit logs
- review legal/privacy impact

Payment issue:

- freeze live payment actions
- verify provider mode
- inspect webhook/event log

## Pilot SLA Proposal

- critical privacy/security: immediate response
- high role/access issue: same business day
- medium usability issue: 1-2 business days
- low demo/content issue: backlog

## Required Disable Switches

- parent onboarding
- parent camera viewing
- AI observer
- payments
- external notifications
- document uploads
- pilot user access

support_incident_status = required_before_real_pilot
