# PILOT FIX 1 - Real Pilot Risk Register

Date: 2026-06-27

| Risk | Severity | Likelihood | Mitigation | Owner type | Pilot decision impact |
| --- | --- | --- | --- | --- | --- |
| RLS misconfiguration | critical | medium | live JWT/RLS negative tests before real data | engineering/security | NO_GO |
| Cross-role data leak | critical | medium | role guard/API/RLS tests with fixtures | engineering/security | NO_GO |
| Sensitive document leak | critical | medium | private buckets, short signed URLs, access logs | engineering/security | NO_GO |
| Signed URL duration too long | high | medium | inspect helpers and target environment settings | engineering/security | NO_GO for documents |
| Service role exposure | critical | low | secret scan, server-only helpers, no client imports | engineering/security | NO_GO |
| Child data mishandling | critical | medium | legal/privacy review and scoped data admission | legal/privacy/product | NO_GO |
| Missing parent consent | critical | high | consent model before parent onboarding | legal/product | NO_GO for parents |
| Camera notice missing | high | high | camera policy/notice before camera use | legal/product | NO_GO for camera |
| AI notice missing | high | high | AI/shadow notice before AI processing | legal/product | NO_GO for AI |
| Data retention unclear | high | medium | retention/deletion policy | legal/ops | NO_GO for real data |
| Account deletion missing | high | medium | publish support/deletion path | product/support | NO_GO for public users |
| Role flow broken | high | medium | E2E pilot journey QA | QA/engineering | NO_GO |
| Mobile layout issues | medium | medium | real-device responsive validation | QA/mobile | limited pilot only |
| Demo data mixed with real data | high | medium | environment separation and labels | ops/engineering | NO_GO |
| No support owner | high | medium | assign pilot owner/SLA | ops/support | NO_GO |
| No incident response | high | medium | incident runbook and rollback | ops/security | NO_GO |
| Parent camera exposure too early | critical | medium | parent viewing disabled by default | legal/security/engineering | NO_GO |
| AI overclaim | high | medium | store/demo copy guardrails | product/legal | NO_GO for AI |
| Raw AI to parents | critical | low | parent access denial tests | engineering/security | NO_GO |
| False positives treated as facts | high | medium | human review and cautious language | AI/product/legal | NO_GO for AI |
| Live/sandbox payment confusion | high | medium | provider mode labels and manual policy | product/engineering | NO_GO for paid pilot |
| Wrong revenue stream | high | low | payment stream separation tests | product/finance | NO_GO for billing |
| Invoice/legal mismatch | high | medium | invoice provider/legal review | finance/legal | NO_GO for billing |
| Notifications sent to wrong users | high | medium | test recipients and scoped notification QA | engineering/provider | NO_GO for external notifications |
