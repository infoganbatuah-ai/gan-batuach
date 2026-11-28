import "server-only";

type StopPilot = (sessionId: string) => boolean | Promise<boolean>;

// One synthetic pilot serving process. Routes may be bundled separately.
const state = globalThis as typeof globalThis & { ganQaCameraPilotStop?: StopPilot };

export function registerQaCameraPilotStop(stop: StopPilot) {
  state.ganQaCameraPilotStop = stop;
}

export function qaCameraPilotStop() {
  if (process.env.NODE_ENV !== "development" || process.env.INTEGRATION_DEVELOPMENT !== "true" ||
      process.env.INTEGRATION_BACKEND !== "LOCAL_SUPABASE" ||
      process.env.GAN_CAMERA_PILOT_QA !== "1") return undefined;
  return state.ganQaCameraPilotStop;
}
