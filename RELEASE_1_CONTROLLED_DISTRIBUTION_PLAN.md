# RELEASE 1 - Controlled Distribution Plan

Date: 2026-06-27

## Recommended Initial Distribution

Preferred:

- protected web demo environment
- synthetic dataset only
- access granted to a short approved stakeholder list
- screen-share demo for investors/partners

## Distribution Options

### Web / Vercel Protected Demo Link

Readiness:

- recommended first path

Requirements:

- staging/demo deployment URL
- environment label
- demo accounts
- synthetic dataset
- provider modes disabled/mock/sandbox

Risks:

- environment confusion
- accidental real data entry

Revocation:

- remove account access
- disable deployment/password
- rotate demo credentials

Real data allowed:

- no

### TestFlight Internal Testing

Readiness:

- not ready

Requirements:

- full Xcode
- Apple Developer account
- internal testers
- archive upload
- privacy metadata

Real data allowed:

- no

### Google Internal Testing

Readiness:

- not ready

Requirements:

- Android debug/release build
- Google Play Console
- signed AAB
- internal tester list
- data safety draft

Real data allowed:

- no

### Local Founder Build

Readiness:

- possible after Android Studio/Xcode local build succeeds

Requirements:

- local device
- configured `CAPACITOR_SERVER_URL`
- no signing secrets in repo

Real data allowed:

- no

### Stakeholder Screen-Share Demo

Readiness:

- recommended

Requirements:

- presenter account
- synthetic data
- agreed script

Real data allowed:

- no

## Access Control

- Use role-specific demo accounts only.
- Keep demo environment separate from production.
- Revoke access immediately after demo window if needed.
- Do not distribute public store links.

distribution_status = controlled_web_demo_recommended
