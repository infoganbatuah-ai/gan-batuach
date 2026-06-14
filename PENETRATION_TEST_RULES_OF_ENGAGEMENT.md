# Penetration Test Rules Of Engagement

**DRAFT FOR AUTHORIZED EXTERNAL SECURITY TESTING**

This document prepares Gan Batuach for an external penetration test. It does not authorize any testing by itself.

## Allowed Environment

- Staging, test or sandbox only.
- Production testing is prohibited unless a separate written approval defines a read-only scope.
- Use only approved test accounts and demo data.

## Prohibited Actions

- No destructive testing.
- No production attack.
- No credential stuffing.
- No denial-of-service or load testing.
- No malware upload.
- No access to real children, parents, medical records, payment records or live camera streams.
- No attempts to extract secrets, service role keys, payment keys, camera credentials or RTSP URLs.

## Testing Window

Testing window must be defined in writing before work begins.

Required details:

- start date and time
- end date and time
- authorized tester names
- source IPs where possible
- emergency contact
- escalation path

## Data Handling Rules

- Evidence must be redacted.
- No secrets in screenshots.
- No raw medical or child data in reports.
- No live camera frames in reports.
- No raw payment card data.
- Use finding IDs and summaries instead of sensitive values.

## Reporting Rules

Every finding should include:

- title
- severity
- affected route/system
- reproduction steps
- evidence summary
- recommendation
- affected role
- whether retest is required

Critical findings must be reported immediately.

## Escalation Path

Critical examples:

- parent accesses another child
- admin bypass
- service role exposure
- camera credentials exposed
- medical data exposure
- payment data exposure
- raw AI exposed to parents

## Safe Testing Limits

All testing should verify controls, not harm systems. If a test could alter data, trigger messages, charge payment, notify parents or expose a real camera stream, stop and request explicit written approval.
