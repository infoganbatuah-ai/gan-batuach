# Apple App Store Privacy Labels Draft

DRAFT FOR FINAL REVIEW

This draft must be reviewed by qualified legal/privacy professionals before App Store submission.

| Data category | Collected | Linked to user | Shared | Purpose | Notes |
| --- | --- | --- | --- | --- | --- |
| Contact info | Yes | Yes | No by default | account, communication, support | parents, staff, managers and inspectors |
| Identifiers | Yes | Yes | No by default | auth, permissions, audit, device tokens | no service keys in app |
| User content | Yes | Yes | No by default | messages, documents, updates, uploads | role-scoped access |
| Health/medical information | Yes where enabled | Yes | No by default | child medical and care workflows | high sensitivity, final legal review required |
| Location | Yes where enabled | Yes | No by default | attendance, pickup and inspection validation | not continuous background tracking by default |
| Payment information | Yes | Yes | Payment provider handles payment processing | status, receipts, invoices | no raw card storage |
| Photos/documents | Yes | Yes | No by default | profile photos, documents, authorized evidence | no real data in screenshots |
| Diagnostics | Future readiness | May be linked | Provider dependent | crash and app health | provider not activated by this phase |
| Camera viewing metadata | Yes if camera viewing enabled | Yes | No by default | access audit, session controls | no RTSP or credentials exposed |

## Review Notes

- Gan Batuach Israel Mode does not use audio monitoring.
- Gan Batuach Israel Mode does not use face recognition.
- Raw AI outputs are not exposed to parents.
- Account deletion and privacy requests connect to the privacy request workflow.

