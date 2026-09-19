export const managementDocumentCategories = {
  garden_document: "garden", safety_certificate: "garden", health_certificate: "garden",
  insurance: "garden", camera_approval: "garden", regulatory: "garden",
  staff_document: "staff", qualification: "staff", training: "staff", first_aid: "staff",
  police_clearance: "staff", background_check: "staff",
  teacher_certificate: "teacher", owner_document: "owner",
  child_document: "child", medical_approval: "child",
  guardian_document: "guardian", inspection_document: "inspection"
} as const;

export type ManagementDocumentCategory = keyof typeof managementDocumentCategories;
export type ManagementDocumentOwner = typeof managementDocumentCategories[ManagementDocumentCategory];

export function documentOwnerFor(category: string): ManagementDocumentOwner | null {
  return Object.prototype.hasOwnProperty.call(managementDocumentCategories, category)
    ? managementDocumentCategories[category as ManagementDocumentCategory] : null;
}

export function effectiveDocumentStatus(input: {
  status: string; expires_at?: string | null; replaced_by?: string | null; deleted_at?: string | null;
  reminder_days_before?: number | null;
}, today = new Date()): string {
  const todayDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
  if (input.deleted_at) return "deleted";
  if (input.replaced_by) return "replaced";
  if (input.expires_at && input.expires_at < todayDate) return "expired";
  if (input.status === "valid" && input.expires_at) {
    const threshold = Math.max(0, Math.min(365, input.reminder_days_before ?? 30));
    const days = (Date.parse(input.expires_at + "T00:00:00Z") - Date.parse(todayDate + "T00:00:00Z")) / 86400000;
    if (days <= threshold) return "expiring_soon";
  }
  return input.status;
}

export const documentMimeExtensions = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"
} as const;

export function supportedDocumentSignature(mime: string, bytes: Uint8Array): boolean {
  if (mime === "application/pdf") return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
  if (mime === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}
