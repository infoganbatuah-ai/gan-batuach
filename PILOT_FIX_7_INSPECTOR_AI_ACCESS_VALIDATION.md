# PILOT FIX 7 - Inspector AI Access Validation

## Result

Inspector AI access is limited to assigned-kindergarten review/status where policy allows.

## Verified Code Path

AI camera event review action allows inspector only after checking the event kindergarten against a garden assigned to that inspector.

## Inspector May

- See assigned kindergarten AI readiness/signals if policy allows.
- Review or mark events according to inspection/compliance policy.

## Inspector Must Not

- See unassigned garden AI events.
- See AI provider secrets.
- Treat AI output as a final determination.
- Receive automatic accusations.
- See raw frames unless policy/legal approval exists.

Manual negative test required: unassigned inspector and assigned inspector against wrong kindergarten.

