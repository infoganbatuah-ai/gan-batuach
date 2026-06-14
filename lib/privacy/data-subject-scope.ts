import "server-only";

export type DataSubjectScopeInput = {
  subjectUserId?: string | null;
  childId?: string | null;
  gardenId?: string | null;
  subjectType?: string | null;
};

export type DataSubjectScopeItem = {
  dataCategory: string;
  tableName: string;
  estimatedRecordCount: number;
  actionRecommendation: "export" | "correct" | "delete" | "anonymize" | "retain" | "review" | "exclude";
  parentExportAllowed: boolean;
  notes: string;
};

const scopedTables = [
  { tableName: "profiles", dataCategory: "profile_data", field: "id", source: "subjectUserId", actionRecommendation: "review", parentExportAllowed: true },
  { tableName: "children", dataCategory: "child_records", field: "id", source: "childId", actionRecommendation: "review", parentExportAllowed: true },
  { tableName: "parents", dataCategory: "parent_records", field: "profile_id", source: "subjectUserId", actionRecommendation: "review", parentExportAllowed: true },
  { tableName: "staff", dataCategory: "staff_records", field: "profile_id", source: "subjectUserId", actionRecommendation: "review", parentExportAllowed: false },
  { tableName: "attendance", dataCategory: "attendance_records", field: "child_id", source: "childId", actionRecommendation: "anonymize", parentExportAllowed: true },
  { tableName: "child_timeline_events", dataCategory: "timeline_events", field: "child_id", source: "childId", actionRecommendation: "export", parentExportAllowed: true },
  { tableName: "child_health_records", dataCategory: "medical_data", field: "child_id", source: "childId", actionRecommendation: "review", parentExportAllowed: true },
  { tableName: "medicine_given_logs", dataCategory: "medical_data", field: "child_id", source: "childId", actionRecommendation: "review", parentExportAllowed: true },
  { tableName: "authorized_adults", dataCategory: "pickup_authorizations", field: "child_id", source: "childId", actionRecommendation: "review", parentExportAllowed: true },
  { tableName: "child_pickup_authorizations", dataCategory: "pickup_authorizations", field: "child_id", source: "childId", actionRecommendation: "review", parentExportAllowed: true },
  { tableName: "pickup_events", dataCategory: "pickup_signatures", field: "child_id", source: "childId", actionRecommendation: "retain", parentExportAllowed: true },
  { tableName: "documents", dataCategory: "documents", field: "child_id", source: "childId", actionRecommendation: "review", parentExportAllowed: false },
  { tableName: "communication_messages", dataCategory: "communications", field: "sender_profile_id", source: "subjectUserId", actionRecommendation: "review", parentExportAllowed: true },
  { tableName: "parent_complaints", dataCategory: "complaints", field: "parent_profile_id", source: "subjectUserId", actionRecommendation: "retain", parentExportAllowed: true },
  { tableName: "incident_cases", dataCategory: "incident_evidence", field: "child_id", source: "childId", actionRecommendation: "retain", parentExportAllowed: false },
  { tableName: "camera_access_audit_trail", dataCategory: "camera_access_logs", field: "profile_id", source: "subjectUserId", actionRecommendation: "retain", parentExportAllowed: false },
  { tableName: "camera_playback_sessions", dataCategory: "camera_access_logs", field: "profile_id", source: "subjectUserId", actionRecommendation: "retain", parentExportAllowed: false },
  { tableName: "observer_intelligence_signals", dataCategory: "ai_telemetry", field: "child_id", source: "childId", actionRecommendation: "anonymize", parentExportAllowed: false },
  { tableName: "skeleton_observer_events", dataCategory: "skeleton_telemetry", field: "garden_id", source: "gardenId", actionRecommendation: "anonymize", parentExportAllowed: false },
  { tableName: "observer_ephemeral_context", dataCategory: "ephemeral_context", field: "child_id", source: "childId", actionRecommendation: "delete", parentExportAllowed: false },
  { tableName: "invoices", dataCategory: "payment_records", field: "profile_id", source: "subjectUserId", actionRecommendation: "retain", parentExportAllowed: true },
  { tableName: "payment_transactions", dataCategory: "payment_records", field: "profile_id", source: "subjectUserId", actionRecommendation: "retain", parentExportAllowed: true },
  { tableName: "immutable_audit_events", dataCategory: "audit_logs", field: "actor_profile_id", source: "subjectUserId", actionRecommendation: "retain", parentExportAllowed: false }
] as const;

function sourceValue(input: DataSubjectScopeInput, source: string) {
  if (source === "subjectUserId") return input.subjectUserId ?? null;
  if (source === "childId") return input.childId ?? null;
  if (source === "gardenId") return input.gardenId ?? null;
  return null;
}

export async function resolveDataSubjectScope(supabase: any, input: DataSubjectScopeInput): Promise<DataSubjectScopeItem[]> {
  const items: DataSubjectScopeItem[] = [];
  for (const table of scopedTables) {
    const value = sourceValue(input, table.source);
    if (!value) continue;
    const result = await supabase
      .from(table.tableName as any)
      .select("id", { count: "exact", head: true })
      .eq(table.field, value);
    items.push({
      dataCategory: table.dataCategory,
      tableName: table.tableName,
      estimatedRecordCount: result.error ? 0 : result.count ?? 0,
      actionRecommendation: table.actionRecommendation,
      parentExportAllowed: table.parentExportAllowed,
      notes: result.error ? `Scope query unavailable: ${result.error.message}` : "Scope calculated from direct relationship."
    });
  }
  return items;
}

export function summarizePrivacyScope(items: DataSubjectScopeItem[]) {
  const totalRecords = items.reduce((sum, item) => sum + item.estimatedRecordCount, 0);
  const legalRetentionItems = items.filter((item) => item.actionRecommendation === "retain").length;
  const exportableItems = items.filter((item) => item.parentExportAllowed).length;
  const deletionCandidates = items.filter((item) => ["delete", "anonymize"].includes(item.actionRecommendation)).length;
  return {
    totalRecords,
    legalRetentionItems,
    exportableItems,
    deletionCandidates,
    categories: [...new Set(items.map((item) => item.dataCategory))]
  };
}
