# Data Migration, Import & External System Integration Platform

## Purpose

PHASE 133 prepares Gan Batuach for fast and safe customer onboarding from spreadsheets, paper records, file folders and future external systems.

The platform is designed around one principle: no existing data is overwritten without validation, preview and explicit confirmation.

## Migration Workflow

1. Upload source material:
   - Excel
   - CSV
   - Google Sheets export
   - PDF/image bundles
   - accounting or CRM exports

2. Choose entity scope:
   - children
   - parents
   - staff
   - documents
   - payments
   - invoices
   - receipts
   - authorized pickup contacts
   - communication preferences

3. Map fields:
   - external field
   - Gan Batuach field
   - required fields
   - validation rules

4. Validate:
   - duplicates
   - missing required fields
   - invalid formats
   - invalid relationships
   - unsupported files

5. Preview:
   - records to create
   - records to update
   - records to skip
   - records requiring manual review

6. Confirm:
   - admin confirmation required
   - preview required
   - rollback plan recorded

7. Import:
   - imported records are counted
   - warnings and failures are retained
   - rollback availability is tracked

8. Verify:
   - data quality snapshot
   - duplicate rate
   - missing fields
   - relationship health

## Core Tables

- `data_migration_batches`
- `data_migration_files`
- `data_mapping_templates`
- `data_migration_preview_rows`
- `data_migration_validation_issues`
- `data_migration_rollback_events`
- `external_system_connectors`
- `data_quality_snapshots`

## Validation Workflow

Validation issues use severity:

- info
- warning
- error
- critical

Issue types:

- duplicate
- missing required field
- invalid format
- invalid relationship
- conflict
- unsupported file
- permission issue
- manual review

Imports should not proceed while unresolved `error` or `critical` issues exist.

## Rollback Workflow

Rollback types:

- full
- partial
- failed import recovery

Rollback events record:

- affected entity type
- affected record count
- rollback snapshot
- reason
- requester
- executor
- execution timestamp

This phase prepares rollback tracking. Actual destructive rollback execution should remain a guarded admin operation.

## Mapping Model

Mapping templates store:

- source system
- entity type
- external-to-internal field mapping
- required fields
- validation rules

Initial templates:

- children CSV
- parents CSV
- staff CSV
- document bundle
- payment balances

## Onboarding Wizard Model

The intended guided flow:

Upload -> Mapping -> Validation -> Preview -> Confirmation -> Import -> Verification

The admin route `/dashboard/admin/migrations` shows the operational state and readiness.

## External System Readiness

Prepared connectors:

- Excel upload
- Google Sheets export
- document bundle upload
- accounting export
- CRM export
- municipal export

No real credentials are required. Future real connectors should use environment variables or encrypted secret storage, not plain database fields.

## Data Quality Dashboard

Quality snapshots track:

- completeness score
- duplicate score
- relationship score
- document score
- overall score
- missing data count
- invalid records count
- duplicate records count

## Safety Rules

- Preview is required before import.
- Confirmation is required before import.
- Existing data is not overwritten automatically.
- Duplicate matches go to manual review.
- Parent/child/staff relationships must validate before import.
- Failed imports must leave validation and rollback history.

## Remaining Production Work

- Build actual file parser endpoints for XLSX/CSV.
- Add secure upload storage flow for import files.
- Implement row-level import execution from confirmed preview rows.
- Implement guarded rollback execution.
- Add manager-facing onboarding migration wizard.
- Add optional OAuth connector for Google Sheets.
- Add production accounting/CRM connectors after credentials and contracts exist.
