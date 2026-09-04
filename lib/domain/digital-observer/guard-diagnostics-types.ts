import type { CameraCapabilityKey, GuardAction } from "./guard-engine";

export type GuardDiagnosticScope = { observer_site_id: string; camera_source_id: string; request_id: string };
export type GuardDiagnosticRequest = GuardDiagnosticScope & (
  { task_kind: "capability_snapshot" } |
  { task_kind: "command_preflight"; action: GuardAction; payload: Record<string, unknown> }
);
export type GuardDiagnosticView = {
  request_id: string; camera_source_id: string; task_kind: "capability_snapshot" | "command_preflight";
  state: "queued" | "running" | "completed" | "failed" | "expired" | "blocked" | "cancelled";
  expires_at: string; audit_recorded: true; executed: false; executor_installed: false;
  requires_immediate_confirmation: true;
  capabilities?: Record<CameraCapabilityKey, boolean>;
  action?: GuardAction; supported?: boolean; evidence_id?: string; verified_at?: string | null;
};
// Diagnostics have no execute method and can never produce a physical ACK.
export interface GuardDiagnosticAdapter {
  request(input: GuardDiagnosticRequest): Promise<GuardDiagnosticView>;
  status(input: GuardDiagnosticScope): Promise<GuardDiagnosticView>;
}
