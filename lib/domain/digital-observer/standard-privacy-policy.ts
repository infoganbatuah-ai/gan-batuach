export type StandardBiometricConsent = {
  confirmed: boolean;
  subjectId?: string | null;
  purpose?: string;
  recordedAt?: string | null;
  revokedAt?: string | null;
};

export function assertStandardBiometricConsent(consent: StandardBiometricConsent) {
  if (consent.confirmed !== true || consent.revokedAt) throw new Error("BIOMETRIC_CONSENT_REQUIRED");
  if (!consent.subjectId) throw new Error("BIOMETRIC_SUBJECT_REQUIRED");
  return { ...consent, purpose: consent.purpose || "standard_security_observation", recordedAt: consent.recordedAt || new Date().toISOString() };
}

export function biometricProfileState(consent: StandardBiometricConsent, now = new Date()) {
  if (!consent.confirmed || consent.revokedAt) return "disabled" as const;
  return consent.recordedAt && new Date(consent.recordedAt).getTime() <= now.getTime() ? "consented" as const : "pending" as const;
}
