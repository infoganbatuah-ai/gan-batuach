# braces 3.0.4-push38-backport.1 provenance

- Base package: `braces@3.0.3` from the npm registry.
- Base package SHA-512 (base64): `yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==`.
- License: MIT; the upstream `LICENSE` file is retained unchanged.
- Security issue: `CVE-2026-93687` / `GHSA-vfj7-8cjw-p6xm`.
- Backport source: upstream pull request `micromatch/braces#72`.
- Backport commit: `d0d575e55e74a4e0218e5248fafb79efc3e54ebb`.
- Scope: add a maximum nesting depth to string parsing and to all recursive AST walkers (`compile`, `expand`, and `stringify`).
- Local version suffix: identifies this reviewed backport while no official patched npm release exists.
- Review date: 2026-10-03.

The runtime files are the official 3.0.3 npm package with only the security changes from the cited upstream commit. The application security gate includes deterministic string-input, direct-AST, configurable-boundary, and normal-pattern regression checks.
