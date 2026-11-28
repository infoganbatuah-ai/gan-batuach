# Home pilot media ingress operations

The home pilot uses two DNS-only media names, one IPv6 firewall rule for TCP
18443, and a user LaunchAgent. The frontend remains on Vercel. Only the
restricted `/playback/claim` and tokenized HLS paths are served by the Mac.

The durable data root is
`/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.dev-cache/media-ingress`.
Runtime source, TLS keys, Cloudflare DNS credentials, certbot state, and logs
stay there with owner-only permissions. The Mac home directory contains only
the two LaunchAgent plist files that start the services. The media server
checks that `/Volumes/DIGITAL_OBSERVER` is mounted before listening and every
ten seconds afterward. An absent volume closes the listener; launchd retries
when the volume is available again.

`com.ganbatuach.media-ingress` restarts the media server after a process exit.
`com.ganbatuach.media-cert-renewal` runs hourly. Certbot renews through a
Cloudflare token scoped to `ganbatuach.com` with `DNS: Edit`; it keeps the
current certificate if renewal fails and restarts the media server only when a
new certificate is installed. The token and private key must never be placed
in Git, logs, shell arguments, or support messages.

## Verification

1. Check both LaunchAgents with `launchctl print gui/$(id -u)/<label>`.
2. Confirm the media process listens only on the configured IPv6 address and
   port 18443. A request to `/` must return 404 with a valid TLS certificate.
3. Run certbot `renew --dry-run --no-random-sleep-on-renew` using the external
   certbot directories. It must report both media names renewed successfully.
4. Check that the DVR and Tapo local health endpoints report progressing media
   relays, then verify moving video in the account on web and iPhone.

## Recovery

Keep a protected copy of the previous working media data and plist on the
external volume during cutover. If the new LaunchAgent fails, stop it with
`launchctl bootout`, restore the previous plist and data from that protected
copy, then `launchctl bootstrap` the previous plist. Verify TLS and playback
before deleting any older copy. Do not unmount the volume to test fail-closed
behavior on a Mac that hosts other active project services; use a nonexistent
`--required-volume` with a loopback-only test listener instead.

The home IPv6 address, DNS AAAA records, and the router rule must continue to
match. A changed ISP prefix requires an address and firewall update before
remote playback resumes. The renewal service handles certificate expiry; it
does not manage a changed ISP prefix or a powered-off Mac.
