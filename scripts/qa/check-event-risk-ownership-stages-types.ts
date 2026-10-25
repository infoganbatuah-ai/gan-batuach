import type { PrePersistEventOwnership, VerifiedEventRiskOwnership } from
  "../../lib/domain/digital-observer/event-risk-ownership-snapshot";

// Compile-only check: the pre-insert chain cannot satisfy a post-read Risk
// requirement, even if its Tenant/Site/Event fields are otherwise identical.
type NotAssignable<From, To> = From extends To ? never : true;
export const preCannotBePost: NotAssignable<PrePersistEventOwnership, VerifiedEventRiskOwnership> = true;
export const postCannotBePre: NotAssignable<VerifiedEventRiskOwnership, PrePersistEventOwnership> = true;
