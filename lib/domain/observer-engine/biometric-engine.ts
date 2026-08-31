import { assertTenantEngineBoundary } from "./policy";
import type { IVisionEngine, StandardObservationEvent, VideoFrame } from "./types";

export class BiometricObserverEngine implements IVisionEngine {
  readonly name = "biometric" as const;
  readonly tenantType = "STANDARD" as const;

  constructor() {
    assertTenantEngineBoundary("STANDARD", this.tenantType);
  }

  async processFrame(frame: VideoFrame): Promise<StandardObservationEvent[]> {
    // Provider-specific biometric integrations belong behind this boundary.
    // This base implementation intentionally emits no identity until a
    // configured Standard provider supplies one.
    void frame;
    return [];
  }

  getCapabilities() {
    return ["FaceIdentification", "BiometricRecognition", "ObjectDetection", "SecurityEventAnalysis"] as const;
  }
}
