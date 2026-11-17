import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { privacyPolicyMatchesTrustedTenant } from "../../lib/domain/digital-observer/privacy-compliance.ts";

test("site-scoped policy cannot borrow another Tenant's legal approval", () => {
  assert.equal(privacyPolicyMatchesTrustedTenant({ policyOrganizationId: "tenant-a", trustedTenantId: "tenant-a" }), true);
  assert.equal(privacyPolicyMatchesTrustedTenant({ policyOrganizationId: "tenant-b", trustedTenantId: "tenant-a" }), false);
  assert.equal(privacyPolicyMatchesTrustedTenant({ policyOrganizationId: null, trustedTenantId: "tenant-a" }), true);
  assert.equal(privacyPolicyMatchesTrustedTenant({ policyOrganizationId: "tenant-b", trustedTenantId: "site-without-org" }), false);
});

test("stored-approval reader checks policy organization against trusted Site Tenant", () => {
  const service = readFileSync(new URL("../../lib/domain/digital-observer/privacy-compliance-service.ts", import.meta.url), "utf8");
  assert.match(service, /privacyPolicyMatchesTrustedTenant\(/);
  assert.match(service, /policyOrganizationId: profile\?\.organization_id \?\? null/);
  assert.match(service, /trustedTenantId: input\.tenantId/);
});
