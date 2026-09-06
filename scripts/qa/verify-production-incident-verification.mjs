import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export default {};" };
    }
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) {
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
        }).outputText
      };
    }
    return next(url, context);
  }
});

const [siteId, incidentId] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
assert.match(siteId ?? "", uuid, "Valid observer site ID required");
assert.match(incidentId ?? "", uuid, "Valid Incident ID required");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && serviceRoleKey, "Production database configuration is unavailable");

const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { evaluatePersistedIncidentVerification } = await import("../../lib/domain/digital-observer/incident-verification-service.ts");
const result = await evaluatePersistedIncidentVerification({ db, observerSiteId: siteId, incidentId });

console.log(JSON.stringify({
  status: "PASS",
  observer_site_id: siteId,
  incident_id: incidentId,
  verification_id: result.verificationId,
  verification_status: result.evaluation.status,
  classification: result.evaluation.classification,
  verification_confidence: result.evaluation.verificationConfidence,
  final_decision: result.evaluation.finalDecision,
  final_decision_confidence: result.evaluation.finalDecisionConfidence,
  required_followup: result.evaluation.requiredFollowup,
  fast_path: result.evaluation.fastPath,
  metrics: result.evaluation.metrics,
  verification_version: result.evaluation.verificationVersion,
  final_decision_version: result.evaluation.finalDecisionVersion
}, null, 2));
