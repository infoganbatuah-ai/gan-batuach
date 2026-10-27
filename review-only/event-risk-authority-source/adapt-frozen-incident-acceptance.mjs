// Exact-anchor review-only delta on the pinned, epoch-fenced canonical writer.
// The fixture loads this in memory. It is never a live migration or route.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const PINNED_FENCED_ACCEPTANCE_SHA256 =
  "eebf1249ffe039b44bf51980bc90ba554dd16ebddbc07893650448cd0eb3717e";

export function adaptFrozenIncidentAcceptance(source) {
  assert.equal(createHash("sha256").update(source).digest("hex"), PINNED_FENCED_ACCEPTANCE_SHA256);
  const before = `    END IF;
    RETURN s.id;
  END IF;

  -- The existing row lock`;
  const after = `    END IF;
    -- Re-read the source-defined correlation under the binding writer's locks.
    -- A same-ID retry may return the original event, never a changed Incident.
    binding_ref := observer_home_review.bind_accepted_event_v1(s.id);
    IF binding_ref IS NULL THEN
      RAISE EXCEPTION 'HOME_BINDING_UNVERIFIED' USING ERRCODE='P0001';
    END IF;
    RETURN s.id;
  END IF;

  -- The existing row lock`;
  assert.equal(source.split(before).length - 1, 1, "replay anchor mismatch");
  const sql = source.replace(before, after);
  assert.match(sql, /binding_ref := observer_home_review.bind_accepted_event_v1\(s.id\);/g);
  return { sql, editCount: 1 };
}
