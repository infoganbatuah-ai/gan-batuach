import { validateObserverQaHostedConfig } from "../../lib/domain/digital-observer/observer-qa-hosted-preflight.mjs";

// Explicit offline preflight; it makes no network request and does not deploy.
// Provider resource ownership and Access policy must be verified separately.
try {
  validateObserverQaHostedConfig(process.env);
  process.stdout.write("OBSERVER_QA_HOSTED_CONFIG_ONLY_PASS\n");
} catch {
  process.stderr.write("OBSERVER_QA_HOSTED_CONFIG_BLOCKED\n");
  process.exitCode = 1;
}
