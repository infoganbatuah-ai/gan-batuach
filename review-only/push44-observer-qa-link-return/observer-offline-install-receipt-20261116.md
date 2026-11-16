# Observer standalone QA offline installation — physical device receipt

On 2026-11-16, the connected physical iPhone 13 Pro accepted a staged, locally
signed `com.digitalobserver.app.qa` build. The installation and launch commands
completed successfully. A post-install device inventory confirmed that both
`com.digitalobserver.app.qa` and the pre-existing `com.ganbatuach.app.qa` remain
installed as distinct applications. Neither application was uninstalled.

The signed staging artifact is held on the Kingston Development volume at
`/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.dev-cache/tmp/push44-observer-offline-signed.pQXyuT/ObserverQA.app`.
Its signed executable SHA-256 is
`1be24f7f450b73f9400b273261690c7f76eccd1d65607a8a5151d85ef4222b80`.
The embedded offline page SHA-256 is
`c9e36076c877afd1ee7b2f005f73042052a51b06ba648460d0d6aafaa0ed1581`.
The embedded provisioning profile expires on 2026-11-23 08:50:36 UTC.
Local strict signature verification passed.

The staged build has the exact `observerqaapp` callback scheme, no Capacitor
remote `server.url`, no PushNotifications plugin, and no `sw.js` or
`firebase-messaging-sw.js` copied into the signed bundle. Its local page is
explicitly an offline installation-status screen, not the authenticated
Digital Observer Product. No external HTTPS route, media, APNs, Home camera,
Production service or Cloudflare configuration was activated.

The owner subsequently identified the separate Hebrew-labeled Observer app
with its Observer icon on the physical iPhone and reported that opening it
displayed "בדיקת התקנה מקומית בלבד". This is owner-reported visible-screen
PASS for the offline QA status page. The observation does not independently
identify the installed executable hash or prove which exact staged build was
shown. Real Product login, Secure Enclave proof, authenticated native return,
media and Push remain unqualified by this offline build.
