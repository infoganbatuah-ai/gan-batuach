# Secure Remote Media Relay

Status: implemented and tested with local synthetic media. NOT deployed or wired
into the persistent Gateway or the production player. Remote viewing is NOT ready.

## Security Boundary

- One approved origin: `https://video-relay.ganbatuach.com`.
- Gateway connections are outbound. No router forwarding or DVR exposure.
- The Relay has no cloud signing key, service role, Keychain access or DVR login.
- A separate 120-second `relay_transport` permission cannot authorize discovery,
  device refresh, camera actions or cloud writes. The cloud checks enrollment
  revocation when issuing and inspecting it. Transport inspection is cached for
  at most 15 seconds, within the permission expiry.
- Viewer grants retain the existing 45-second expiry and cloud nonce ledger.
  The Gateway must redeem each grant at the cloud's playback-grant endpoint,
  which checks current device/site/source mapping before consuming its nonce.
- Viewer sessions are restricted to one source and expire after 120 seconds.
  Continuous viewing still requires a reviewed renewal integration.
- Only an HLS playlist and named MPEG-TS segments can pass through. Arbitrary
  URLs, files, recorder commands, playlist keys and redirects are rejected.
- The Relay keeps bounded buffers in memory only. It never records video and
  exposes no media archive. TLS proxy and hosting access logs must not record
  query strings, authorization headers, bodies or media.
- Session/task limits are per Gateway, with a bounded replica total. A failed
  channel cannot terminate another channel's session.

## Required Rollout Gates

1. Provision a system-owned server suitable for media forwarding. Verify account
   ownership, billing, DNS and TLS for the fixed origin before any grant or media
   is sent there. Ordinary public Cloudflare Tunnel/CDN is not the selected
   hosting plan for this service.
2. Run `node services/video-relay/server.mjs` behind a TLS reverse proxy on that
   host. The Node listener binds only to loopback. Do not expose its HTTP port.
   Retain both `services/video-relay` and `services/video-gateway/relay-protocol.mjs`.
3. Verify unauthorized requests fail; inspect correct certificate/hostname and
   `/health`; configure egress accounting and per-tenant budget limits. Neither
   an unlimited usage plan nor a 10,000-user capacity claim is implemented.
4. Deploy the cloud route with `VIDEO_GATEWAY_REMOTE_RELAY_ENABLED` initially off.
   Enable it only for the verified rollout. No new shared Relay secret is needed.
5. Add explicit, default-off persistent Gateway integration for
   `createRemoteRelay`. Inject the existing Keychain-backed lease and grant claim
   functions; allow only known HLS assets from the local stream registry. No
   credentials or profile files may be passed to the Relay.
6. Add the authenticated browser route and seamless session renewal. Keep local
   viewing functional during rollout; never redirect grants to an arbitrary URL.
7. Verify from a separate authenticated device/network: advancing media, renewal,
   revocation, reconnect after Gateway/Relay restart, offline-channel isolation,
   and event thumbnail/clip. Only then mark remote viewing available.

## Checks

`node scripts/qa/check-secure-media-relay.mjs` exercises the cloud authorization
route, broker and inert Gateway client with fake identities/media. It checks
scope separation, revocation, tenant mapping, replay, expiry, URL injection,
bounded bodies and independent recovery. It makes no DVR or production request.

This is a single-replica broker. A multi-replica rollout needs authenticated
Gateway affinity and load/egress tests; in-memory sessions intentionally expire
on restart. Do not advertise full scalability from these unit tests.
