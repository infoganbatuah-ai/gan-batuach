export function observerCameraEmptyState(input: {
  cameraCount: number;
  offlineCount: number;
  status?: string;
  hasFilter: boolean;
}) {
  if (input.status === "offline" && input.cameraCount > 0) return {
    title: "אין מצלמות מנותקות", description: "כל המקורות הרשומים משדרים כרגע.", action: "none" as const
  };
  if (input.hasFilter && input.cameraCount > 0) return {
    title: "לא נמצאו מצלמות לפי הסינון", description: "אפשר לנקות את החיפוש והמסננים כדי לראות את שאר המצלמות.", action: "clear_filters" as const
  };
  if (input.cameraCount > 0) return {
    title: "אין כרגע מצלמה עם וידאו חי", description: "המקורות נשמרו ויחזרו לכאן אוטומטית כשהשידור יתחדש.",
    action: input.offlineCount > 0 ? "show_offline" as const : "none" as const
  };
  return { title: "אין מצלמות מחוברות", description: "הוסיפו מקליט או מקור מצלמות. פרטי החיבור נשמרים רק ב-Gateway המקומי.", action: "add_camera" as const };
}
