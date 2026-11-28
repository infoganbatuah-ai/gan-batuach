export function observerCameraEmptyState(input: {
  cameraCount: number;
  offlineCount: number;
  status?: string;
}) {
  if (input.cameraCount === 0) return {
    title: "אין מצלמות משויכות",
    description: "אפשר להוסיף מקליט או מקור מצלמה.",
    action: "add_camera" as const,
  };
  if (input.status === "offline" && input.offlineCount === 0) return {
    title: "אין מצלמות ללא שידור זמין",
    description: "כל המקורות המשויכים זמינים לצפייה חיה.",
    action: "none" as const,
  };
  return {
    title: "לא נמצאו מצלמות לפי הסינון",
    description: "אפשר לנקות את החיפוש והמסננים כדי לראות את שאר המצלמות.",
    action: "clear_filters" as const,
  };
}
