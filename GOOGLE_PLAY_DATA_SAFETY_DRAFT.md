# Google Play Data Safety Draft

DRAFT FOR FINAL REVIEW

This draft must be reviewed before Play Console submission.

## Data Collected

- contact information
- identifiers
- user content
- health/medical information where enabled
- location where enabled
- payment references and invoice metadata
- photos/documents where uploaded
- diagnostics if a provider is enabled later
- camera viewing metadata if camera viewing is enabled

## Purpose

- app functionality
- account management
- role-based communication
- documents and approvals
- payments and invoices
- inspection workflows
- safety updates after review
- security and audit logging
- support

## Sharing

Data is not broadly shared. Subprocessors may process data for hosting, notifications, payments, invoices, storage, support or diagnostics, subject to provider configuration and legal review.

## Security

- encryption in transit required
- private documents are role-scoped
- no raw card data stored
- camera credentials and RTSP URLs are not exposed to the app
- server secrets are not included in mobile builds

## Deletion

The mobile app must expose a privacy/account deletion request path. Admin review applies where retention, legal hold, evidence or financial obligations apply.

