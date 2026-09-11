# GB-M11 — Canonical Classroom Entity

## Before State

Garden age categories existed in onboarding, fee groups and free-text Child/Staff columns. They could not represent two operational classrooms in the same age category, and `payment_group_id` was sometimes used as a class identifier.

## Canonical Classroom Model

`classrooms` is the canonical Garden-owned operational unit with a stable ID, name, configurable category key/label, optional age bounds in months, lifecycle status, order, source and audit metadata. Category and Classroom identity are deliberately separate.

## Age Group vs Classroom

Age group is configurable classification data on a Classroom. A Classroom is a specific named operational unit. No age-group key is unique within a Garden and no category is described as legal truth.

## Multi-Class Same Age Group

The unique identity is Garden plus Classroom name. Onboarding accepts a classroom count per selected category and creates independently addressable rooms such as `פעוטים צעירים 1` and `פעוטים צעירים 2`.

## Child Assignment

`child_classroom_assignments` preserves movement history and enforces one current assignment per Child and Garden. The assignment RPC serializes moves and checks Child, enrollment and Classroom Garden equality. Parent authority remains unchanged.

## Staff Assignment

`staff_classroom_assignments` allows one active Staff member to serve several Classrooms. It requires an approved Staff record and validates an explicitly supplied employment relationship. Classroom scope does not replace employment authority.

## Owner/Teacher Semantics

Owners/managers manage Classroom structure through canonical `can_manage_garden` authority. Owners are not inserted into Staff assignments. Delegated Teacher Garden authority remains separate and is not broadened into structural Classroom management.

## Onboarding Integration

GB-M10 category selection now writes canonical Classroom records idempotently. One room is the default; an explicit count creates several rooms of the same category. Removed onboarding rooms are inactivated rather than deleted.

## Legacy Migration

Each unambiguous `kindergarten_age_group_setups` row produces one minimum compatibility Classroom. The migration never guesses a higher Classroom count. Legacy fee, group and free-text fields remain readable while new writes prefer Classroom IDs.

## APIs

`GET/POST/PATCH /api/garden/classrooms` supports scoped list, create, update, deactivate, Child move, Staff assignment and Staff unassignment operations.

## RLS / Authorization

RLS uses canonical Garden access for reads and canonical Garden management for writes. Database triggers reject cross-Garden Child, enrollment, Staff, employment and Classroom combinations. Service-role access is not used by the Classroom API.

## Security Tests

Focused contracts cover active Garden authority, same-Garden constraints, candidate Staff denial, historical Child movement, safe deactivation and same-age multiple Classroom identity.

## Live QA

`LIVE CLASSROOM QA: BLOCKED BY ENVIRONMENT` — no controlled non-customer Garden, Child and Staff identities are available for destructive CRUD testing.

## Hard-Coded Ratio Findings

Legacy `kindergarten_age_group_setups`, `calculateRequiredStaff` and `kindergartenAgeGroups` still contain fixed capacity/ratio assumptions. GB-M11 does not copy these values into Classroom policy. GB-M13 must replace them with versioned configured policy and legal review.

## Remaining Debt

GB-M12 owns capacity and seat reservations. GB-M13 owns ratio policy. GB-M14/15 consume age eligibility and Classroom candidates for discovery/enrollment. Legacy free-text display fields can be retired after all readers use canonical assignments.

## Inputs For GB-M12

Use `classrooms.id` as the seat-capacity scope and `child_classroom_assignments` as current occupancy evidence. Do not infer capacity from age category or legacy free-text Child fields.

## Digital Observer Boundary

`DIGITAL OBSERVER CORE DIFF: 0`
