# Digital Observer Domain and Vercel Setup

Status: readiness documentation only. No DNS, Vercel or production routing changes were performed in this phase.

## Current Route

Digital Observer currently lives inside the existing Gan Batuach project:

- `/digital-observer`
- `/digital-observer/dashboard`
- `/digital-observer/onboarding`
- `/digital-observer/sites/[id]`

This keeps the product shell in the existing codebase while reusing shared camera, AI, observer, audit, workflow and analytics infrastructure.

## Recommended Domain Options

Future domain candidates:

- `observer.gan-batuach.co.il`
- `app.digitalobserver.ai`
- `digital-observer.co.il`
- `app.digital-observer.co.il`

Use one public marketing host and one app host only when the product is ready to separate acquisition traffic from authenticated app traffic.

## Environment Variables

Host routing is optional and disabled until configured.

Server-only variables:

- `DIGITAL_OBSERVER_PUBLIC_HOST`
- `DIGITAL_OBSERVER_APP_HOST`
- `GAN_BATUACH_PUBLIC_HOST`

Examples:

```env
DIGITAL_OBSERVER_PUBLIC_HOST=digital-observer.co.il
DIGITAL_OBSERVER_APP_HOST=app.digitalobserver.ai
GAN_BATUACH_PUBLIC_HOST=gan-batuach.co.il
```

Comma-separated values may be used for preview or staging domains.

Do not use `NEXT_PUBLIC_` for host routing controls unless a client-facing configuration endpoint is intentionally added later.

## Vercel Custom Domain Steps

1. Open the existing Vercel project for Gan Batuach.
2. Add the selected Digital Observer domain under Project Settings → Domains.
3. Follow Vercel's DNS instructions for the domain.
4. Wait for verification and SSL issuance.
5. Set `DIGITAL_OBSERVER_PUBLIC_HOST` and/or `DIGITAL_OBSERVER_APP_HOST` in the Vercel environment.
6. Deploy a preview build and verify:
   - root path routes to `/digital-observer`
   - `/dashboard` routes to `/digital-observer/dashboard`
   - `/onboarding` routes to `/digital-observer/onboarding`
   - `/sites/[id]` routes to `/digital-observer/sites/[id]`
   - `/api/*` and `/auth/*` remain unmodified
7. Confirm Gan Batuach domain routes still work normally.

## DNS Records

Use the records Vercel provides for the selected domain.

Typical patterns:

- Apex domain: A record to Vercel's assigned IP, if required by Vercel.
- Subdomain: CNAME to Vercel's assigned target.

Do not guess DNS records. Use the values shown in the Vercel dashboard.

## Preview Domain Behavior

Preview deployments should continue to work through Vercel preview URLs.

Host-based routing only activates when the incoming host matches one of the configured environment variables.

If the variables are empty, no Digital Observer domain routing occurs.

## Production Domain Behavior

When `DIGITAL_OBSERVER_PUBLIC_HOST` or `DIGITAL_OBSERVER_APP_HOST` matches the request host, the proxy rewrites:

- `/` to `/digital-observer`
- `/dashboard` to `/digital-observer/dashboard`
- `/onboarding` to `/digital-observer/onboarding`
- `/sites/[id]` to `/digital-observer/sites/[id]`
- other non-API paths to `/digital-observer/*`

The proxy does not rewrite:

- `/api/*`
- `/auth/*`
- already-prefixed `/digital-observer/*`

## SSL Notes

SSL should be managed by Vercel after domain verification.

Do not handle certificates manually inside the app.

## Rollback Plan

If routing causes issues:

1. Clear `DIGITAL_OBSERVER_PUBLIC_HOST` and `DIGITAL_OBSERVER_APP_HOST`.
2. Redeploy or restart the Vercel deployment.
3. Remove or disable the custom domain in Vercel if needed.
4. Keep `/digital-observer` accessible under the existing Gan Batuach domain.

## Safety Boundaries

- No new Vercel project was created.
- No new Supabase project was created.
- No production DNS was changed.
- No restricted capability was enabled.
- Gan Batuach routes remain unchanged.
- API and auth routes are not rewritten by Digital Observer host routing.
