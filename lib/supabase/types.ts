import type { UserRole } from "@/lib/roles";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Row, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type LooseRow = Record<string, Json>;
type LooseInsert = Record<string, Json | undefined>;

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          role: UserRole;
          garden_id: string | null;
          full_name: string;
          phone: string | null;
          active: boolean;
          must_change_password: boolean;
        },
        {
          id: string;
          role: UserRole;
          garden_id?: string | null;
          full_name: string;
          phone?: string | null;
          active?: boolean;
          must_change_password?: boolean;
        }
      >;
      gardens: Table<
        {
          id: string;
          name: string;
          city: string;
          address: string | null;
          status: string;
          safe_status: string;
          inspector_id: string | null;
          manager_id: string | null;
          email: string | null;
          owner_name: string | null;
          phone: string | null;
          framework_type: string;
          children_capacity: number;
          public_profile_enabled: boolean;
        },
        {
          id?: string;
          name: string;
          city: string;
          address?: string | null;
          status?: string;
          safe_status?: string;
          inspector_id?: string | null;
          manager_id?: string | null;
          email?: string | null;
          owner_name?: string | null;
          phone?: string | null;
          framework_type?: string;
          children_capacity?: number;
          public_profile_enabled?: boolean;
        }
      >;
      children: Table<
        { id: string; garden_id: string; full_name: string; status: string; parent_completed: boolean },
        { id?: string; garden_id: string; full_name: string; status?: string; parent_completed?: boolean }
      >;
      tasks: Table<LooseRow, LooseInsert, LooseInsert>;
      inspections: Table<LooseRow, LooseInsert, LooseInsert>;
      inspection_forms: Table<LooseRow, LooseInsert, LooseInsert>;
      inspection_form_questions: Table<LooseRow, LooseInsert, LooseInsert>;
      violations: Table<LooseRow, LooseInsert, LooseInsert>;
      leads: Table<LooseRow, LooseInsert, LooseInsert>;
      parents: Table<LooseRow, LooseInsert, LooseInsert>;
      teachers: Table<LooseRow, LooseInsert, LooseInsert>;
      staff: Table<LooseRow, LooseInsert, LooseInsert>;
      inspectors: Table<LooseRow, LooseInsert, LooseInsert>;
      messages: Table<LooseRow, LooseInsert, LooseInsert>;
      complaints: Table<LooseRow, LooseInsert, LooseInsert>;
      documents: Table<LooseRow, LooseInsert, LooseInsert>;
      attendance: Table<LooseRow, LooseInsert, LooseInsert>;
      camera_streams: Table<LooseRow, LooseInsert, LooseInsert>;
      camera_view_logs: Table<LooseRow, LooseInsert, LooseInsert>;
      parent_camera_permissions: Table<LooseRow, LooseInsert, LooseInsert>;
      video_stream_sessions: Table<LooseRow, LooseInsert, LooseInsert>;
      camera_snapshots: Table<LooseRow, LooseInsert, LooseInsert>;
      restricted_areas: Table<LooseRow, LooseInsert, LooseInsert>;
      ai_observer_rules: Table<LooseRow, LooseInsert, LooseInsert>;
      ai_alerts: Table<LooseRow, LooseInsert, LooseInsert>;
      incident_timeline: Table<LooseRow, LooseInsert, LooseInsert>;
      notifications: Table<LooseRow, LooseInsert, LooseInsert>;
      task_view_logs: Table<LooseRow, LooseInsert, LooseInsert>;
      mandatory_procedures: Table<LooseRow, LooseInsert, LooseInsert>;
      procedure_acknowledgements: Table<LooseRow, LooseInsert, LooseInsert>;
      campaigns: Table<LooseRow, LooseInsert, LooseInsert>;
      report_exports: Table<LooseRow, LooseInsert, LooseInsert>;
      rate_limit_events: Table<LooseRow, LooseInsert, LooseInsert>;
      staff_certificates: Table<LooseRow, LooseInsert, LooseInsert>;
      staff_shifts: Table<LooseRow, LooseInsert, LooseInsert>;
      gallery_items: Table<LooseRow, LooseInsert, LooseInsert>;
      schedule_items: Table<LooseRow, LooseInsert, LooseInsert>;
      medical_events: Table<LooseRow, LooseInsert, LooseInsert>;
      pickup_confirmations: Table<LooseRow, LooseInsert, LooseInsert>;
      video_gateway_connections: Table<LooseRow, LooseInsert, LooseInsert>;
      stream_health_checks: Table<LooseRow, LooseInsert, LooseInsert>;
      ai_events: Table<LooseRow, LooseInsert, LooseInsert>;
      audit_logs: Table<LooseRow, LooseInsert, LooseInsert>;
    };
    Views: {
      unsafe_gardens: Table<LooseRow, never, never>;
    };
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
    CompositeTypes: Record<string, never>;
  };
}
