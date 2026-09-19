# Commercial release custody — implementation and activation gate

Updated: 2026-09-19. Owner: Digital Observer release owner. Status: **ACCOUNT OWNER APPROVED TWO KMS KEYS; KEYS/COMMERCIAL PROOF NOT YET ACTIVATED**.

## Decision and current evidence

The owner requires a commercial release-security path. R2 remains the artifact data plane; no alternate artifact host is introduced. The proposed signing provider is AWS KMS because its remotely generated Ed25519 keys fit the existing PUSH 19 verification protocol. On 2026-09-19 the owner confirmed control of an existing AWS account, authorized its exclusive future Digital Observer use, and approved the two-key signing cost. The old project had two running EC2 instances; both were subsequently verified `Stopped`. Its EBS/IP resources and historical costs have not been fully retired. **No KMS key or signing identity has yet been provisioned.** Account inventory, least-privilege policy review and real KMS proof remain open. Detailed provider billing and identifiers are kept in the restricted supplier ledger, not this report.

The new release-side tooling uses KMS `ECC_NIST_EDWARDS25519`, `ED25519_SHA_512`, and `MessageType: RAW`. It checks immutable key ARN, expected public-key fingerprint, enabled AWS-generated customer key, returned algorithm, and signature against the canonical on-device verifier. It has no private-key input, generation, export, or local signing fallback. Root and release keys must differ. Documents over 4,096 canonical bytes are rejected; switching to Ed25519ph or signing an application-created digest would change the existing protocol and is forbidden here. See [KMS signing API](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html) and [KMS key specifications](https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html).

`node scripts/qa/check-remote-edge-signer.mjs` passed 14 deterministic protocol/negative cases. Existing root-pin/rotation/revocation regression passed. These tests use ephemeral fixtures and prove code behavior only. Actual KMS authentication, IAM denial, audit, key custody, signing, and offline verification are **NOT TESTED**. Local macOS identity enumeration returned `0 valid identities found`; that proves no usable local signing identity was found, not that the owner has no Apple Developer account.

## Concrete account setup

1. Use the existing owner-approved AWS account; do not create another account or permanent access keys for CI. Establish authorized administrator login with MFA/SSO, review remaining legacy resources, and confirm chosen KMS region support and current price before provisioning.
2. Provision two separate asymmetric signing keys generated in KMS: trust-registry root and release signer. Retain them on infrastructure deletion/replacement; never schedule deletion as routine rollback. An authorized key administrator manages policy/lifecycle. A separate root-signing role signs reviewed registry changes. The GitHub release role cannot sign root registries or change either key policy.
3. Configure GitHub OIDC federation using exact repository/environment and `aud=sts.amazonaws.com`; restrict environment deployment branches and require owner review. Restrict release role to `kms:DescribeKey`, `kms:GetPublicKey`, and `kms:Sign` on the exact release key ARN. Permit the pure Ed25519 algorithm only. No key creation, grants, policy changes, disabling, deletion, or general administrator permission for the release job. Review fork/PR triggers and the precise code that receives the identity. The current `HOME_QA_SIGNING` environment is a protected QA environment with one permitted branch; it is not a complete commercial signing pipeline. See [GitHub OIDC for AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).
4. Enable and verify auditable KMS operations with retention, access controls, and cost recorded in the restricted supplier record. Bind each approved job to commit, canonical payload digest, artifact hash, signer fingerprint, and resulting signature. Do not put Home device IDs, signed URLs, or credentials into public Actions logs or artifacts. Root-pin distribution requires an independently approved fingerprint; fetching a key from the signing response does not authorize it by itself.
5. Test actual denied calls from wrong role/environment, root signing from release role, disabled key, substituted fingerprint, and altered payload. Then sign a release and registry in KMS and verify through the existing Gateway/Connector verifier. Record provider request/audit references in controlled evidence. Only this provider-backed run can close the custody gate.

## Operator interface prepared in code

`scripts/release/sign-edge-document-kms.mjs` takes three positional file paths: unsigned canonical document, reviewed signer configuration, and new output path in a restricted directory. It invokes an installed official AWS CLI with existing short-lived credentials and bounded retries/timeouts. It does not provision credentials or keys. Existing outputs are rejected.

Signer configuration contains only `keyArn`, `keyId`, `publicKeySha256`, and `role` (`ROOT_REGISTRY` or `RELEASE_MANIFEST`). An administrator obtains the public-key fingerprint through the approved key-creation ceremony. No PEM private key is accepted. The command writes the signed document and a digest-based evidence record with owner-only permissions. Execution is pending approved account setup. No executable workflow was added that could run automatically on a push.

## Apple distribution gate

Owner-approved sequencing (2026-09-15): defer Apple enrollment, Developer ID, and notarization until final macOS distribution. These are NOT prerequisites for provider-backed R2 delivery, device-authentication, tenant-isolation, or remote release-signature verification. Record those mechanisms separately from complete commercial macOS package readiness. This deferral does not authorize a Gatekeeper bypass, invalid managed package, local root-key generation, new paid signing service, or live runtime activation. The remote release-custody gate remains required for the chosen cloud-signing path.

The Connector needs the organization's valid Developer ID signing route, hardened runtime, appropriate entitlements, secure timestamp, nested-code verification, notarization, stapled-ticket validation, and Gatekeeper assessment of the final distributed package. Keep signing identity in the approved build service; do not install it on the Home runtime. Apple supports cloud-managed Developer ID certificates for eligible roles; verify compatibility with the existing custom bundle pipeline before selecting that route. [Developer ID requirements](https://developer.apple.com/help/account/certificates/create-developer-id-certificates), [notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

The three qualified Home-QA archives remain unchanged. A new KMS manifest signature cannot turn an ad-hoc signed macOS bundle into a Developer ID distribution package. A commercial Apple-signed build necessarily receives a new artifact hash and release identity and must repeat package/lifecycle verification. Preserve existing QA archives as historical evidence; do not overwrite or relabel them.

## Cost decision — approved scope, no KMS activation yet

AWS lists $1 per KMS key per month: two keys imply **$2/month key storage**, plus metered asymmetric operations and audit/retention costs. Asymmetric signing/GetPublicKey calls are excluded from KMS's free request tier. The public pricing example quotes $0.15/10,000 ECC signing requests; confirm the chosen region/Ed25519 SKU before using that rate as a binding estimate. A dedicated CloudHSM cluster is not proposed. [AWS pricing](https://aws.amazon.com/kms/pricing/).

Apple Developer Program lists **$99/year or local currency** if membership is not already held. Actual local checkout, taxes, FX, cloud macOS build minutes, and audit retention remain to be measured. [Apple enrollment](https://developer.apple.com/programs/enroll/). These are not included in the historical $0 R2 QA projection.

The owner separately approved two customer-managed signing keys and their metered use; this document itself is not spending authority for any other AWS service. Record actual supplier plans and allocation in the existing restricted cost ledger. All-in cost per active paying user and infrastructure cost per registered user remain NOT YET MEASURABLE while authoritative denominators/full bills are missing. Stopping old EC2 compute does not establish that the account is project-only: EBS, IPv4 and other resources must be checked against provider billing after cleanup. This is not an assertion of either ₪15 ceiling being achieved.

## Completion evidence still required

- Authorized remote keys, root pin, real signing/audit/denial proof.
- Signed exact-device R2 manifests, three immutable uploads and round-trip SHA/size proof.
- Reviewed deployed control-plane/device authentication with live negative tenant/device tests, bounded grants and staging.
- Owner-authorized protected trust installation, live trust negative tests, unchanged baselines and Home health.
- For commercial Connector distribution: valid final Developer ID package, notarization/Gatekeeper and managed update/rollback proof.
- PUSH 38 reliability completion remains separately gated by remediation deployment, pre-soak, and a successful new 24-hour qualification. PR #28 stays draft/unmerged under the user's current instruction.
