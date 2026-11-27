# UXV12 Parent mobile readability follow-up

Status: scoped visual correction; owner reference acceptance and cumulative release gates remain open.

Source: `integration/development@ac091181b671204637494369fdfd4b975d813b53`.
Route: `/dashboard/parent`, synthetic two-child Parent, isolated local Development backend.

The first full-page 390px capture of the merged UXV12 Product exposed two mobile defects that the earlier cropped screenshot missed. Update rows without a `<time>` rendered their text in a fixed 56px grid column, and the camera capability status overlapped the illustrative-image disclaimer.

The scoped CSS gives time-free updates a flexible text column and reserves height and bottom space for the camera's two truthful labels. Rows with `<time>` retain three columns. No data, permissions, routes, provider configuration, migration, or live-camera claim changes.

At 390px in the feature preview, the document width was 390px, the first update's text column was 252px, and the camera preview height was 182px. Full-page visual inspection showed readable update rows and separated camera labels. Protected screenshot: `exports/restricted/uxv12-parent-20261113/mobile-fix-preview.jpg`, SHA256 `1078956adbd86edf4da93c06e2b28eb59b23ec4166543dd85a91c4fd86379f65`. This is synthetic local QA evidence, not owner visual approval or Production proof.

Before integration, run typecheck, zero-regression lint, focused Parent context checks, exact-head PR gates, and verify the merged canonical Product. Do not release to `main` or Production from this unit.
