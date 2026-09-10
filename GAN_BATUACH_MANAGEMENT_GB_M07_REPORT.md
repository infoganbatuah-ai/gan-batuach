# GB-M07 — Canonical parent, guardian, child and garden linking

Date: 2026-09-10

## Result

PASS. `child_guardian_links` is now the canonical source for a parent's or guardian's legal relationship and access to a permanent child file. Garden access derives from that relationship plus the child's enrollment, while `parent_kindergarten_links` remains an affiliation and invitation compatibility record.

## Delivered

- Added a many-to-many guardian-child model with relationship type, primary designation, legal authority, scoped permissions, lifecycle dates and audit metadata.
- Backfilled canonical links from permanent child files and the older child/parent records without inventing a second guardian from unverified text fields.
- Added a synchronization trigger so remaining legacy writers that set `primary_parent_profile_id` also produce the canonical relationship.
- Added canonical child-access and parent-garden-access database functions.
- Replaced child file, enrollment and timeline read policies with canonical guardian checks.
- Updated child creation, enrollment activation, enrollment requests, signed invitation acceptance, parent dashboard, family context and kindergarten discovery to use canonical links.
- Preserved existing parent and garden interfaces while allowing more than one authorized guardian to see the same child.

## Security properties

- A profile identifier alone does not grant child access; the link must be active, legally authorized, within its validity period and explicitly allow the requested scope.
- Parents cannot create their own guardian relationship through direct RLS writes.
- Garden staff see a guardian relationship only through an enrolled child and their existing garden authority.
- Legacy free-text mother/father details are not treated as verified identities.

## Compatibility and boundary

`primary_parent_profile_id`, legacy `parents` rows and `parent_kindergarten_links` remain available for older code, exports and affiliation state. They no longer define the canonical family authorization path. Digital Observer core was not changed.

## Validation

The GB-M07 contract, prior management contracts, TypeScript, lint baseline, domain/security gates, migration health, release contract and production build are required before merge.
