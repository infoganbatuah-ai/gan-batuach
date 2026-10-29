# Source-only OCI fixture qualification

The existing extractor remains restricted to disposable synthetic TAR fixtures
(`synthetic-fixture-only`, at most 32 MiB of layer input). The new OCI fixture
entrypoint requires an externally pinned SHA-256 of a small manifest, exactly
29 indexed arm64 layer descriptors, and a matching SHA-256 for every layer.
This is a deliberately small synthetic descriptor plan, not a parser for the
real Docker-save manifest or a registry OCI manifest.
Duplicate JSON keys, extra manifest fields, wrong architecture, missing layers,
and descriptor or payload mismatches are rejected before target writes.

The extractor now bounds cumulative regular-file bytes and the set of path
components, rejects path components over 255 UTF-8 bytes, and rejects a
non-directory ancestor declared in the same layer. Existing no-follow
directory traversal, private scratch target, special-node denial, whiteout
handling, mode stripping, and exact target-inode rollback remain in force.

This is **source-only synthetic qualification**. The approved real-image gate
remains `None`/`null`; the 1.33-GB Supabase QA archive cannot enter the fixture
entrypoint. No VM, guest network-isolation proof, real-image extraction,
PostgreSQL restore, or backup restore occurred. The VZ execution-context gate
and all restore acceptance gates remain open.

Verification: `python3 review-only/event-risk-authority-source/synthetic-rootfs-extractor.test.py -q`
passes 19 tests, including the 29-layer manifest, digest mismatch, resource
bounds, traversal, symlink, hardlink, whiteout, and rollback cases.
The unchanged guest-rootfs review contract passes 5/5 Node tests with the
existing local dependencies temporarily linked for the test; the link was
removed afterward. An initial Node invocation without that dependency link
failed to import `tar` and is not counted as a passing run.

An additional synthetic Docker-save planner now checks a pinned outer archive
digest, one manifest/config pair, exactly 29 ordered layer references, a
content-addressed config, arm64/linux, and each uncompressed layer diff ID.
It rejects extra or duplicate entries, links, traversal, duplicate JSON keys,
and inputs above 32 MiB. The planner accepts bytes only and does not read a
path, extract a layer, boot a guest, or enable the real-QA gate. Its planned
payloads require separate conversion and extractor validation before any use.
Six hostile-fixture tests pass. This is not a streaming parser for the actual
Docker-save archive and does not change the VZ or restore status.
