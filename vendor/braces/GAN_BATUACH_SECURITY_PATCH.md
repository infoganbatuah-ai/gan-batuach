# Gan Batuach security patch for `braces`

This directory vendors the official npm `braces@3.0.3` package and applies a
bounded nesting-depth guard for CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm.

The upstream advisory currently lists every published version through 3.0.3 as
affected and does not identify a patched release. The package version is marked
`3.0.4-gan-batuach.0` so npm audit can distinguish this mitigated local package
from the vulnerable upstream release.

The patch rejects brace nesting deeper than 100 by default, before the recursive
compile and expand walkers run. Callers may request a lower or higher positive
integer through the existing options object, capped at 1000 to retain a bounded
stack. Input length remains bounded by the original `MAX_LENGTH` behavior.
The vendor copy also removes the upstream package's debug `console.log` from the
invalid-close compile path so glob processing cannot emit input fragments.

Provenance:

- Source: official npm tarball `braces@3.0.3`
- Tarball integrity:
  `sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==`
- Upstream license: MIT, retained in `LICENSE`
- Advisory: `GHSA-vfj7-8cjw-p6xm`
- Added dependency cost: ₪0
