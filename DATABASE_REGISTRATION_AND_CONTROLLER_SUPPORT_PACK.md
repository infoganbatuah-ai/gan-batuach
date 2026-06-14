# Database Registration And Controller Support Pack

**DRAFT FOR LEGAL REVIEW**

## System Purpose

Support kindergarten management, child safety readiness, parent communication, staff compliance, inspections, payments, document management, camera access and reviewed observer signals.

## Data Subjects

- children
- parents
- staff
- managers
- inspectors
- platform admins

## Data Categories

- identification and contact data
- child enrollment and attendance data
- medical and allergy data
- pickup authorization data
- staff certifications and clearance readiness
- camera access metadata
- AI observer metadata
- payment and invoice metadata
- audit logs

## Access Roles

Access is scoped by role, garden, child, assignment and admin authorization.

## Security Controls

- Supabase Auth
- RLS readiness
- MFA readiness
- audit logs
- private storage
- field-level encryption readiness
- CI/CD security gates

## External Review Questions

- Is database registration or notification required?
- Who is listed as database owner/controller?
- What records must be included in a filing?
