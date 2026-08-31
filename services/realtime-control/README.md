# Realtime Control Provisioning

Status: fail-closed bootstrap, locally tested, NOT deployed. It does not publish,
subscribe to or record media. `/health` reports configuration separately from
`signaling_enabled` and `live_verified`; both latter values remain false.

## Verified Provisioning Blocker

On 2026-08-31, the connected Cloudflare account could read the owned zone and
list Workers/Realtime applications. Creating `ganbatuach-realtime-control` failed
with API authentication error 10000. A follow-up listing confirmed no Worker was
created. No SFU application/secret/domain or media session was created.

Use an authenticated account with the required Workers write, Realtime and zone
permissions. Do not route playback grants to an unverified or unrelated host.
Keep `CF_RTC_APP_ID` and `CF_RTC_APP_SECRET` in Worker secret bindings; never put
them in this file, Wrangler vars, Git, browser responses or Gateway files.

## Intended Media Architecture

1. Existing enrolled Gateway obtains a short-lived, site/device-scoped permission
   from the application server. Device refresh material stays in macOS Keychain.
2. An outbound publisher uses a maintained WebRTC media implementation. Adapt
   only already-authorized local source media; send no DVR login or private
   source URL to cloud signaling. Do not hand-roll RTP/DTLS/SRTP.
3. The control service validates current device/site/source permissions and
   atomically consumes viewer grants. It never accepts arbitrary SFU session,
   track or destination identifiers from an untrusted client.
4. Cloudflare Realtime SFU carries media tracks, not encoded HLS over data
   channels. Browsers receive only their authorized camera tracks. No continuous
   archive/recording is configured. Existing event evidence has a separate
   48-hour retention policy.
5. Lease expiry, revocation, tenant isolation, inactive-viewer cleanup, source
   offline isolation and bounded reconnect must pass before enabling signaling.
6. Roll out behind an explicit feature flag after synthetic publisher/subscriber
   tests, then test real source media and renewal from a second device/network.
   A configured SFU account is not proof of live video.

The sibling Node HLS broker is a tested provider-independent alternative, not an
implementation of Cloudflare Realtime. Do not deploy it onto ordinary public
Cloudflare Tunnel/CDN as a substitute for a supported video service.

## Cost and Release Gates

Realtime currently documents $0.05/GB egress after the first 1,000 GB monthly free
allowance. This is not an all-inclusive cost guarantee. Do not use the shared
free allowance as a per-customer entitlement. Before enabling production media,
implement tenant-level byte/time accounting and atomic quota reservations,
concurrency and bitrate limits, and idle-viewer shutdown. Allocate a media
budget below the user's NIS 15/month/customer TOTAL provider cap, allowing for
taxes, exchange rates, infrastructure, event storage and notification providers.
When the budget is exhausted, stop or lower quality visibly, not silently incur
unbounded charges. No 10,000-user load/cost acceptance has been established.

## Official References

- [Realtime SFU HTTPS API](https://developers.cloudflare.com/realtime/sfu/https-api/)
- [Realtime data-channel constraints](https://developers.cloudflare.com/realtime/sfu/datachannels/)
- [Realtime pricing](https://developers.cloudflare.com/realtime/turn/faq/)
- [Cloudflare video-delivery policy](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/)

Run `node scripts/qa/check-realtime-provisioning.mjs` for the bootstrap's negative
capability checks. This uses synthetic configuration and makes no cloud/DVR call.
