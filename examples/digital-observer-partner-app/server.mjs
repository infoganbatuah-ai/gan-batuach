// Independent partner example: imports only the published SDK surface.
import { DigitalObserverServerClient } from "../../packages/digital-observer-sdk/src/index.ts";

export async function loadAuthorizedPartnerCustomer({ baseUrl, credential, siteId, fetch }) {
  const client = new DigitalObserverServerClient({ baseUrl, credential, fetch });
  const [cameras, events, incidents] = await Promise.all([client.cameras(siteId), client.events(siteId), client.incidents(siteId)]);
  return { cameras: cameras.data, events: events.data, incidents: incidents.data, privateModulesImported: false };
}

export async function provisionSyntheticCustomer({ baseUrl, credential, customerOrganizationId, siteId, entitlementGrantIds, fetch }) {
  const client = new DigitalObserverServerClient({ baseUrl, credential, fetch });
  return client.provisionPartnerCustomer({ customer_organization_id: customerOrganizationId, external_customer_reference: `synthetic-${customerOrganizationId}`,
    site_ids: [siteId], entitlement_grant_ids: entitlementGrantIds, idempotency_key: `sample-${customerOrganizationId}` });
}
