export type InspectionDraftSaveState = "idle" | "loading" | "dirty" | "saving" | "saved" | "error";

// A late draft response must never replace answers entered while it was loading.
export function mergeLoadedInspectionAnswers<T>(saved: Record<string, T>, local: Record<string, T>): Record<string, T> {
  return { ...saved, ...local };
}

export function settleInspectionDraftLoad(current: InspectionDraftSaveState, savedCount: number): InspectionDraftSaveState {
  if (current === "dirty" || current === "saving" || current === "saved") return current;
  return savedCount > 0 ? "saved" : "idle";
}
