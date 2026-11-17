# Observer QA black-screen diagnosis (read-only iPhone inventory)

Connected physical iPhone 13 Pro inventory listed two separate applications:
`com.ganbatuach.app.qa` (older English-named shell) and
`com.digitalobserver.app.qa` (new Hebrew-named standalone shell). The latter
had a running `ObserverQA.app/App` process. Neither app was removed, relaunched,
reinstalled or modified during diagnosis.

The protected local signed Observer artifact has executable SHA-256
`8bbad3647b369f7da31bc3fee2fc003bf6c86e14d1b8123504be986e1507dcb9`
and exact bundle ID `com.digitalobserver.app.qa`. Its embedded Capacitor config
sets `server.url` to `https://observer-qa.example.invalid/digital-observer/dashboard`
with `bundledWebRuntime: false`. A local status `public/index.html` is present
but the remote `server.url` overrides it. The `.invalid` destination is a
plausible explanation for the owner's black-screen observation; the installed
binary could not be independently hashed from the device, and no device web
console or screen image was captured. This is **not** proof of a Product crash.

The source-only correction removes `server.url` and finalizes a separate,
network-free Observer status page into the unsigned QA bundle. A local unsigned
finalizer rehearsal succeeded; the embedded page SHA-256 matched its source,
and the resulting config contained no remote URL. The temporary rehearsal
copies and module cache (about 67 MiB) were removed afterward. No signed
replacement was made or installed, so the current iPhone screen has **not**
been fixed or visually requalified. The offline page is not the real
authenticated Observer dashboard. Real Product display still requires an
approved secure Development origin and a separate signed-device test.
