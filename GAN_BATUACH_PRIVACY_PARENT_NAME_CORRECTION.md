# Parent self-name correction — Development handoff

Source: `b723bb2a7331a020566b665829206b12b745f57b` on `origin/integration/development`.
Branch: `codex/gb-privacy-parent-name-correction-20261115`.
Scope: an authenticated, active Parent may propose a correction to their **own** `profiles.full_name`. Admin review, an explicit one-row `profiles` scope, and the existing privacy request approval are required before the atomic change. Child, Garden, birth date, email, medical, documents, and media corrections remain review-only and require separate authority. No production or Digital Observer core change.

The proposal stores the proposed name and a SHA-256 digest of the prior name. Its Parent/Admin read policy and RPC checks prohibit cross-Parent access or direct table mutation. Submission locks the Parent profile row to serialize concurrent proposals. The Admin apply function locks the request, proposal and profile; refuses stale names, holds/conflicts, insufficient scope, previous execution, inactive/non-Parent subjects, and any non-self subject context. It then changes the profile, writes immutable audit and execution action, and completes the request in one database transaction. This is not a general privacy correction engine. Retention for proposal/request evidence remains subject to legal review.

Validation on a restored, disposable synthetic QA stack only:

- Migration applied to isolated QA database; canonical Development database was not written.
- Rollback-only SQL regression passed for self-scoped submission, other-Parent isolation, Parent apply denial, duplicate denial, preapproval denial, stale-profile denial, atomic successful apply/audit, and repeat-apply denial.
- Authenticated loopback HTTP QA passed on the disposable stack: Parent submission 200, other-Parent proposal visibility 0, Parent apply 403, Admin preapproval apply 400, Admin scoped review and approval 200, Admin apply 200, Parent profile readback 200, one linked execution action, and replay apply 400. This changed only disposable restored synthetic QA data, which must be destroyed after validation.
- The final source review strengthened only the submission row lock from `FOR SHARE` to `FOR UPDATE` to serialize concurrent requests. The disposable stack had already been removed; the listed SQL/HTTP runtime results cover the preceding lock mode. Exact final-source migration CI and a concurrent-submission rerun remain required before merge.
- Migration health, TypeScript typecheck, lint regression, domain gate (56/56) and release-contract checks passed locally.
- Local security gate did **not** pass: two unchanged Digital Observer CH1 media tests require external-volume ownership evidence unavailable in this host context (`CH1_VOLUME_OWNERSHIP_REQUIRED`). No gate was weakened.
- Local Next build did **not** finish: after copying the existing locked dependencies into this external worktree, it remained at “Creating an optimized production build” without progress and was interrupted. Exact-head CI build is still required.
- Visual browser verification of the new Parent/Admin form remains pending. The authenticated HTTP path is verified, but it is not browser proof.

Publication and integration remain pending. The next owner must commit and push the scoped change, open a PR to `integration/development`, obtain every required exact-head CI gate green, merge with ledger registration, apply the new migration to the canonical isolated Development database in order, and verify the Parent/Admin journey there. No `main` or Production action is authorized by this handoff.
