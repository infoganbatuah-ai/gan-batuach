# MOBILE WEB SYNC STRATEGY

Date: 2026-06-27

## Current Strategy

Gan Batuach mobile uses the same Next.js/React UI as the web app through Capacitor.

The current native app strategy is:

- Capacitor WebView
- remote/server-loaded app URL via `server.url`
- `CAPACITOR_SERVER_URL` or `NEXT_PUBLIC_APP_URL` selects the URL
- fallback for development: `http://localhost:3000`

This is a hybrid webview strategy, not a self-contained static export of all Next.js routes.

## How UX Changes Reach Mobile

For normal UI/layout/content changes:

1. Build and deploy the web app.
2. Mobile app loads the updated deployment URL.
3. No native rebuild is required if the app shell, native plugins, icons, splash assets, and config are unchanged.

For native-affecting changes:

1. Run `npm run build`.
2. Run `npx cap sync`.
3. Rebuild Android/iOS native projects.
4. Validate on real devices.

Native-affecting changes include:

- Capacitor config changes
- plugin changes
- native permissions
- Android/iOS icons or splash
- deep links/app links
- push notification native setup
- store package metadata

## Store Build Requirements

Before App Store / Google Play packaging:

- Set `CAPACITOR_SERVER_URL` to the production or pilot HTTPS URL.
- Run `npx cap sync`.
- Validate Android debug build locally or in Android Studio.
- Validate iOS build in Xcode.
- Confirm app icon and splash assets.
- Confirm no signing keys or certificates are committed.
- Confirm push provider setup if push is included in the release.

## Risks

- If `CAPACITOR_SERVER_URL` is missing during store packaging, the app may point to localhost and fail on real devices.
- Remote URL strategy depends on web deployment availability.
- Packaged offline/static behavior is not currently validated.
- Native push requires FCM/APNs setup beyond web push readiness.

## Recommendation

Continue with the current hybrid strategy for controlled pilot/internal demo validation, but require a release-specific build checklist before MOBILE 2 packaging and submission readiness.
