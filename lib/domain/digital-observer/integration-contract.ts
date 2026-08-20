export const digitalObserverIntegrationScopes = [
  "camera:status:read",
  "event:metadata:read",
  "snapshot:signed-url:read",
  "clip:signed-url:read",
  "alert:metadata:read",
  "health:read"
] as const;

export type DigitalObserverIntegrationScope = (typeof digitalObserverIntegrationScopes)[number];

export type GanBatuachObserverIntegrationContext = {
  clientKey: "gan_batuach";
  gardenId: string;
  observerSiteId: string;
  requestedScope: DigitalObserverIntegrationScope;
  requestId: string;
};

export const ganBatuachObserverIntegrationPolicy = {
  activeByDefault: false,
  directTableSharingAllowed: false,
  parentAccessInherited: false,
  shortLivedSignedMediaRequired: true,
  auditEveryRequest: true,
  allowedScopes: digitalObserverIntegrationScopes,
  forbiddenPayloadFields: [
    "secret_reference",
    "rtsp_url",
    "camera_username",
    "camera_password",
    "provider_api_key",
    "biometric_reference"
  ]
} as const;
