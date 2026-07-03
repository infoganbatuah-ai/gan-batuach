# PILOT FIX 7 - Manager AI Access Validation

## Result

Manager AI access is intended to be scoped to the manager's own kindergarten and policy-approved internal review only.

## Verified Code Paths

- AI camera event review action checks manager/owner `profile.garden_id` against event `kindergarten_id`.
- Garden AI pages load own-kindergarten context through server-side profile/garden scoping.
- Parent summaries are not a manager bypass; publication must remain policy-reviewed.

## Manager A May

- See AI readiness for Kindergarten A.
- See internal review items for Kindergarten A if policy allows.
- Review/dismiss/confirm own-kindergarten candidate events through human review.

## Manager A Must Not

- See Kindergarten B AI events.
- See provider secrets.
- See unredacted raw provider diagnostics.
- Publish parent summaries without approved workflow.
- Create automatic accusations.

Manual negative test required: Manager A cannot access Kindergarten B AI routes/API rows.

