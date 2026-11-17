import assert from 'node:assert/strict';
import test from 'node:test';
import { onboardingReviewRequirements } from '../../lib/domain/kindergarten-onboarding-review.ts';

test('review distinguishes observed activation blockers from optional profile work', () => {
  const missing = ['logo', 'profile_image', 'children_setup', 'parent_invitations', 'documents'];
  const beforeConsent = onboardingReviewRequirements(['documents', 'platform_terms', 'privacy_terms'], missing, false);
  assert.deepEqual(beforeConsent.required, ['סיכום מצב מסמכים', 'אישור תנאי השימוש ומדיניות הפרטיות']);
  assert.deepEqual(beforeConsent.optional, ['לוגו', 'תמונת גן', 'הוספת ילדים', 'הזמנת הורים']);
  assert.equal(beforeConsent.canSubmit, false);

  const afterConsent = onboardingReviewRequirements(['documents', 'platform_terms', 'privacy_terms'], missing, true);
  assert.deepEqual(afterConsent.required, ['סיכום מצב מסמכים']);
  assert.equal(afterConsent.canSubmit, false);
});

test('confirmed consent permits submit only when canonical non-consent blockers are gone', () => {
  const blockers = ['platform_terms', 'privacy_terms'];
  const optional = ['logo', 'class_capacity_setup', 'payment'];
  assert.equal(onboardingReviewRequirements(blockers, optional, false).canSubmit, false);
  const ready = onboardingReviewRequirements(blockers, optional, true);
  assert.deepEqual(ready.required, []);
  assert.deepEqual(ready.optional, ['לוגו', 'קיבולת כיתות', 'הסדרת מנוי']);
  assert.equal(ready.canSubmit, true);
});

test('unknown canonical blocker fails closed and required fields never become optional', () => {
  const state = onboardingReviewRequirements(['future_required_check'], ['kindergarten_name', 'address', 'phone', 'documents', 'logo'], true);
  assert.deepEqual(state.required, ['דרישת הפעלה נוספת']);
  assert.deepEqual(state.optional, ['לוגו']);
  assert.equal(state.canSubmit, false);
});
