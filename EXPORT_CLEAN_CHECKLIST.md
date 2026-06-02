# Clean Export Checklist

Use this checklist before sending a project ZIP.

## Required exclusions

The export must never include:

- `.env.local`
- `.env`
- `.env.*`
- `.next`
- `node_modules`
- `.git`
- `__MACOSX`
- `.DS_Store`

## Recommended command

Use:

```bash
npm run export:clean
```

The script creates a ZIP under `exports/` and excludes local secrets, build output, dependency folders and macOS archive metadata.

## Manual ZIP warning

If you create a ZIP manually from Finder, macOS may include `__MACOSX` and `.DS_Store`.

Prefer the clean export script so collaborators do not receive local artifacts or secrets.
