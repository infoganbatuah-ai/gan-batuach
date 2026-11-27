# Dormant iOS QA return host boundary

The shared native target has distinct Gan (`com.ganbatuach.app.qa`) and
Observer (`com.digitalobserver.app.qa`) installation identities and callback
schemes. However, both dormant return primitives still point to the Gan-era
`qa-iphone-device-proof.ganbatuach.com` host and `/qa/device-proof` paths.
The available source does not establish a separately approved Observer HTTPS
host, exact return path, AASA entitlement, or server callback contract.

Until those facts are established, `QaAccessReturnGate.begin` and `.consume`
and `QaAsWebAuthReturn.prepare` reject the Observer bundle. Both primitives
remain `enabled = false`; the system-browser identity provider remains `nil`.
This prevents accidental acceptance of a Gan-host return by Observer while
retaining the existing Gan-only dormant contract. It does not assert that the
Gan host is active, nor does it qualify a physical iPhone return.

Future activation requires an exact approved Observer control origin and
return contract, trusted TLS and iOS callback association, server-side state
exchange, and live-device qualification. No DNS, route, entitlement, service,
database or media change was made in this local review unit.
