# Mobile Platform Architecture Confirmation

Status: submission support document.

Gan Batuach mobile architecture is:

- Next.js web application
- React UI
- TypeScript codebase
- Capacitor mobile wrapper
- iOS native shell
- Android native shell

Gan Batuach is not:

- React Native
- Flutter

Native capabilities should be provided through Capacitor plugins and native project configuration only where the feature is actually required and reviewed.

## Current Release Boundary

The app-store package is prepared from the existing project. This phase does not create a new mobile repository and does not publish an app.

## Security Boundary

The mobile bundle may contain public configuration only:

- public app URL
- public Supabase URL
- Supabase anon/publishable key
- safe public deep link configuration

The mobile bundle must not contain:

- Supabase service role key
- payment secrets
- invoice provider keys
- WhatsApp/SMS/email secrets
- camera gateway secrets
- AI provider keys
- signing certificates
- private keys
- keystore passwords

## Gan Batuach Israel Mode

For kindergarten mode:

- no audio monitoring
- no face recognition
- no raw AI parent alerts
- human review remains required for safety conclusions

