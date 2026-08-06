# AUTHED UX/UI QA 2 - Session Switching Results

## Method Attempted

1. Opened local app through the browser against `http://localhost:3000`.
2. Used the normal login form for the Parent account.
3. Attempted to switch to other roles without auth bypass.
4. Direct GET navigation to `/api/auth/logout` failed because the route is POST-only and was blocked by the browser.
5. Attempted POST-style logout through browser evaluation, but the browser evaluate sandbox did not expose `fetch`.

## Result

| Method | Status | Notes |
|---|---|---|
| Parent normal login | PASS | Parent dashboard loaded and screenshots were captured. |
| Direct logout URL | FAIL_SAFE | Route is POST-only; browser reported blocked navigation. |
| Browser evaluation POST logout | FAIL_ENVIRONMENT | `fetch` was not available in the read-only/evaluate scope. |
| Other role login after Parent session | NOT_ACCEPTED | Login form was not available because the existing Parent session remained active. |

## Safety

No auth bypass, no arbitrary user-id switching, no service-role browser exposure and no RLS weakening were used.

## QA Impact

AUTHED UX/UI QA 2 cannot accept Manager, Staff, Inspector, Admin or Digital Observer dashboards from this run.
