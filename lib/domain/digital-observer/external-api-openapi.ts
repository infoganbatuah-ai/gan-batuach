import { DIGITAL_OBSERVER_EXTERNAL_API_PREFIX, DIGITAL_OBSERVER_EXTERNAL_API_VERSION, externalApiScopes } from "./external-api-contract";

export const digitalObserverExternalOpenApi = {
  openapi: "3.1.0",
  info: {
    title: "Digital Observer External API",
    version: DIGITAL_OBSERVER_EXTERNAL_API_VERSION,
    description: "Tenant- and Site-scoped intelligence API. It does not expose camera credentials, raw private media, unrestricted Evidence URLs or biometric conclusions."
  },
  servers: [{ url: DIGITAL_OBSERVER_EXTERNAL_API_PREFIX }],
  security: [{ serviceAccount: [], requestSignature: [] }],
  paths: {
    "/cameras": { get: { operationId: "listCameras", summary: "List authorized camera sources", parameters: [{ name: "site_id", in: "query", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Bounded camera page" } } } },
    "/cameras/{id}": { get: { operationId: "getCamera", summary: "Read camera connection, health and capabilities", responses: { "200": { description: "Camera detail" } } } },
    "/events": { get: { operationId: "listEvents", summary: "List canonical Events", responses: { "200": { description: "Bounded Event page" } } } },
    "/events/{id}": { get: { operationId: "getEvent", summary: "Read one canonical Event", responses: { "200": { description: "Event detail" } } } },
    "/incidents": { get: { operationId: "listIncidents", summary: "List canonical Incidents", responses: { "200": { description: "Bounded Incident page" } } } },
    "/incidents/{id}": { get: { operationId: "getIncident", summary: "Read one canonical Incident and authorized workflow actions", responses: { "200": { description: "Incident detail" } } } },
    "/evidence/{id}": { get: { operationId: "getEvidence", summary: "Read scoped Evidence metadata", responses: { "200": { description: "Evidence reference without embedded private media" } } } },
    "/evidence/{id}/media": { get: { operationId: "openEvidenceMedia", summary: "Authorize then redirect to a short-lived private Evidence URL", responses: { "307": { description: "Short-lived redirect" } } } },
    "/investigations/search": { post: { operationId: "searchInvestigation", summary: "Run a grounded authorized historical investigation", responses: { "200": { description: "Grounded canonical results" } } } },
    "/watch-rules": { get: { operationId: "listWatchRules", summary: "List Watch Rules" }, post: { operationId: "manageWatchRule", summary: "Compile or change the state of a Watch Rule; external actions remain disabled" } },
    "/webhooks/subscriptions": { get: { operationId: "listWebhookSubscriptions", summary: "List signed webhook subscriptions" }, post: { operationId: "createWebhookSubscription", summary: "Register an allowlisted disabled/sandbox webhook" } },
    "/integrations/capabilities": { get: { operationId: "listIntegrationCapabilities", summary: "Truthful DVR/NVR/VMS/vendor integration capabilities" } },
    "/integrations/deep-links": { post: { operationId: "createIntegrationDeepLink", summary: "Create a configured customer VMS deep link without exposing credentials" } },
    "/federation/query": { post: { operationId: "federatedQuery", summary: "Query configured federated sources without copying credentials or claiming unsupported access" } },
    "/gan-batuach/contract": { get: { operationId: "getGanBatuachContract", summary: "Read the Site-authorized separate-domain Gan Batuach integration contract", parameters: [{ name: "site_id", in: "query", required: true, schema: { type: "string", format: "uuid" } }] } }
  },
  components: {
    securitySchemes: {
      serviceAccount: { type: "http", scheme: "bearer", bearerFormat: "dosvc_<one-time-secret>" },
      requestSignature: { type: "apiKey", in: "header", name: "X-DO-Signature", description: "HMAC-SHA256 over version, method, path+query, timestamp, nonce and body digest. Also send X-DO-Timestamp and X-DO-Nonce." }
    },
    schemas: {
      Error: { type: "object", required: ["error", "api_version"], properties: { error: { type: "object", required: ["code", "request_id"] }, api_version: { type: "string" } } },
      Pagination: { type: "object", properties: { next_cursor: { type: ["string", "null"] }, limit: { type: "integer", maximum: 100 } } }
    }
  },
  "x-digital-observer": {
    scopes: externalApiScopes,
    default_rate_limit_per_minute: 120,
    idempotency_header: "Idempotency-Key",
    replay_window_seconds: 300,
    deprecation_policy: "A breaking version receives at least 180 days' notice after owner-approved external activation; no Production support window is claimed before that approval.",
    provider_activation: "disabled",
    universal_camera_compatibility_claimed: false,
    gan_batuach_authorization_domain_merged: false
  }
} as const;
