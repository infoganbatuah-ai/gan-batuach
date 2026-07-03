# PILOT FIX 6 - Camera Capability Matrix

Date: 2026-07-03

| Role | Status/list | Request token | Live stream | Recordings | Health | Metadata | Add/update/disable | Diagnostics | Credentials/RTSP | Audit logs | Export evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anonymous/public | denied | denied | denied | denied | denied | denied | denied | denied | denied | denied | denied |
| parent without approved child link | denied | denied | denied | denied | denied | denied | denied | denied | denied | denied | denied |
| parent with approved child link | locked/readiness only | denied by default | denied by default | denied | no | no | no | no | never | no | no |
| staff unassigned | denied | denied | denied | denied | denied | denied | denied | denied | never | no | no |
| staff assigned | policy-only status if enabled | only if explicitly allowed | disabled by default | denied | limited if allowed | no | no | no | never | no | no |
| manager pending | denied | denied | denied | denied | denied | denied | denied | denied | never | no | no |
| manager active | own kindergarten only | own kindergarten if policy allows | internal only after signoff | disabled unless approved | own kindergarten | own kindergarten safe fields | own kindergarten metadata/disable | redacted | never | own/audit summary if allowed | no unless policy |
| inspector unassigned | denied | denied | denied | denied | denied | denied | denied | denied | never | no | denied |
| inspector assigned | assigned garden status | assigned garden with reason if policy allows | policy-only after signoff | denied unless approved | assigned garden | no credential metadata | no | redacted | never | limited if allowed | no unless policy |
| admin | operational status | yes for diagnostics if policy allows | operational/test only | disabled unless implemented | yes | safe metadata | yes | redacted | never | yes | policy-only |
| Digital Observer customer/admin | DO site scope only | product-scoped only | product-scoped only | product-scoped only | DO scope | DO scope | DO scope | redacted | never | product-scoped | product-scoped |

## Hard Requirements

- No role may view raw camera credentials in UI/client.
- Parent live view remains locked unless every parent-viewing condition passes.
- Admin diagnostics must remain redacted.
- Digital Observer camera capabilities must stay product-scoped.
