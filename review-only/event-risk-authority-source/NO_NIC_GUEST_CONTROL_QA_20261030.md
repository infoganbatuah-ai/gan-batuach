# No-NIC disposable guest control/result QA — 2026-10-30

Scope: local, isolated Apple Virtualization Framework preflight only. No database,
archive extraction, Colima, Docker, camera, Production, provider change, remote
publication, or migration. This receipt is not a guest isolation PASS.

## Inputs and boundary

- Existing signed-public Ubuntu 24.04 cloud image was converted to RAW. The
  verified source RAW SHA-256 is
  `70c4b0a60310b3a995a359b2a85258590608057f90b81567bbe27ac650aa00f4`.
  Each attempt used a fresh writable APFS clone, never the verified source.
- Existing public-input ISO was attached read-only, SHA-256
  `c3bc6ba91070169e485df78b3e2ec56f581eafcc007f31888f58a7297d193edb`.
  It was not extracted or executed. The fresh, synthetic NoCloud seed ISO was
  separately attached read-only. EFI variables and a 1 MiB result disk were
  fresh and private to each disposable attempt.
- Native configuration validated with four block devices, zero NICs, zero
  directory shares, zero sockets, and one one-way virtio-console serial result
  channel. The guest probe was designed to check NICs, IPv4/IPv6 default
  routes, unreachable external route, read-only input attachment, exact input
  checksums, and clean shutdown. These guest assertions did **not** execute to
  completion; host configuration alone is not guest egress proof.

## Actual attempts

| Attempt | Private scratch suffix | Native PID | Observation | Result |
| --- | --- | ---: | --- | --- |
| 1 | `guest-control.JeU70g` | 80393 | 300-second bounded run; zero serial bytes; no guest result | `QA_VM_DID_NOT_SHUT_DOWN_CLEANLY` |
| 2 | `guest-control.AhuGzv` | 83059 | Fresh boot, NoCloud seed and result disk; 300-second bounded run; zero serial bytes and zero-filled result disk | `QA_VM_STOP_UNVERIFIED` (runner did not then observe forced-stop callback) |

The second stopped disposable RAW contains a cloud-init `init-local` log entry:
`DataSourceNoCloud [seed=/dev/vdc]`, with this attempt's nonce and both
user-data/meta-data read. It also records fallback network configuration as
disabled. A bounded scan found no later `init`, `config`, or `final` cloud-init
stage. This narrows the failure to boot progression after NoCloud discovery;
it does not establish why that stage stalled. The early boot-command marker
and final result were absent. No guest shutdown PASS or in-guest isolation
result is claimed.

## Implementation/validation

- The review-only contract and four focused deterministic tests passed (4/4).
- The native runner typechecked with an isolated writable Swift module cache.
- After the second attempt, the runner was corrected to observe forced-stop
  completion or stopped VM state before reading the result disk. That
  correction is statically validated, **not** empirically qualified by a third
  guest run.
- The synthetic cloud-init YAML parsed and its embedded shell passed `sh -n`.
  This is syntax evidence, not proof the guest ran it.

## Exact remaining qualification gap

The disposable Ubuntu guest has not reached the result probe or a clean
shutdown. Before another boot, extract or otherwise inspect the stopped
guest's systemd/cloud-init logs without mounting or modifying the original
Development environment. Identify the post-`init-local` stall, make one
bounded correction to the disposable input/boot path, then rerun with a fresh
scratch/nonce. Only a guest-produced result, verified no-NIC/routes and
read-only input, plus observed clean stop may close this QA gate. If that
cannot be obtained, keep the gate BLOCKED.

No remote push was made; this work belongs only to the scoped local branch.
