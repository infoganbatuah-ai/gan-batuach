import type { UserRole } from "@/lib/roles";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: UserRole; garden_id: string | null; full_name: string; phone: string | null; active: boolean };
        Insert: { id: string; role: UserRole; garden_id?: string | null; full_name: string; phone?: string | null; active?: boolean };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      gardens: {
        Row: { id: string; name: string; city: string; address: string | null; status: string; safe_status: string; inspector_id: string | null; manager_id: string | null };
        Insert: { id?: string; name: string; city: string; address?: string | null; status?: string; safe_status?: string; inspector_id?: string | null; manager_id?: string | null };
        Update: Partial<Database["public"]["Tables"]["gardens"]["Insert"]>;
      };
      children: {
        Row: { id: string; garden_id: string; full_name: string; status: string; parent_completed: boolean };
        Insert: { id?: string; garden_id: string; full_name: string; status?: string; parent_completed?: boolean };
        Update: Partial<Database["public"]["Tables"]["children"]["Insert"]>;
      };
      tasks: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      inspections: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      inspection_forms: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      inspection_form_questions: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      violations: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      leads: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      parents: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      teachers: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      staff: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      inspectors: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      messages: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      complaints: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      documents: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      attendance: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      camera_streams: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      camera_view_logs: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      parent_camera_permissions: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      video_stream_sessions: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      camera_snapshots: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      restricted_areas: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      ai_observer_rules: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      ai_alerts: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      incident_timeline: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      notifications: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      task_view_logs: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      mandatory_procedures: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      procedure_acknowledgements: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      campaigns: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      report_exports: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      rate_limit_events: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      staff_certificates: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      staff_shifts: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      gallery_items: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      schedule_items: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      medical_events: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      pickup_confirmations: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      video_gateway_connections: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      stream_health_checks: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      ai_events: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      audit_logs: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
    };
    Views: Record<string, never>;
    Functions: {
      create_monthly_inspection_tasks: { Args: { p_month?: string }; Returns: Json };
      submit_inspection_with_answers: {
        Args: { p_inspection_id: string; p_answers: Json; p_gps_lat: number; p_gps_lng: number; p_gps_radius_meters?: number };
        Returns: Json;
      };
      can_parent_view_camera: { Args: { p_parent_id: string; p_camera_stream_id: string }; Returns: boolean };
      process_monthly_inspection_reminders: { Args: { p_now?: string }; Returns: Json };
      escalate_task: { Args: { p_task_id: string; p_reason: string; p_actor_id?: string }; Returns: Json };
    };
    Enums: {
      app_role: UserRole;
    };
  };
}
