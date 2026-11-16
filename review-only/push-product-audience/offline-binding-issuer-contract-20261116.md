# Offline Push binding issuer contract

`lib/domain/push-binding-issuer.ts` is disconnected and default-off. No active
registration or sender imports it. It never reads client metadata or grants
product identity from a label. The function returns denial unless explicitly
enabled **and** supplied with two trusted server adapters: cryptographic
provider-evidence verification and a single atomic nonce-consume/binding-write
transaction. The current repository supplies neither adapter. No database
table, provider, device or Push sender was changed.

The candidate receipt binds the authenticated profile, installation, exact
provider-token SHA-256, product audience, provider, allowlisted app ID,
canonical challenge digest and the earlier of challenge/verdict expirations. It
never contains the raw token.
The verdict policy currently allows only source-backed Gan Release pairings;
Observer QA, unsupported builds and legacy unbound tokens cannot be promoted
by this contract. Existing Gan registration/delivery behavior is unchanged.

Focused synthetic tests cover disabled/missing adapters, exact token hash,
profile, app ID, nonce change and replay, expiration, revocation, forged or
missing evidence, and persistence refusal. A test fixture may return an
already-verified verdict and simulate an atomic write; it is **not** Apple App
Attest, Google Play Integrity, provider-token ownership, database atomicity,
or real device proof.

Activation dependencies: qualify each shipping app's bundle/package and
provider pairing; implement and review an actual Apple/Google evidence decoder
and signature/issuer verification; bind its challenge to the exact token hash;
implement durable one-use nonce/counter custody and a private service-only
binding table/writer in one transaction; verify session, profile, app,
installation, expiration and revocation at registration and dispatch; determine
how legacy Gan tokens reenroll without silently reclassifying them. Only after
authorized Development DB and provider qualification may both active senders
consume the binding. No SQL or provider verification was attempted here.
