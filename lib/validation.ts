import { z } from "zod";

export const idParam = z.string().uuid();

export const gardenSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  address: z.string().optional(),
  framework_type: z.string().default("mixed"),
  owner_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional()
});

export const childSchema = z.object({
  garden_id: z.string().uuid(),
  primary_parent_id: z.string().uuid().optional(),
  full_name: z.string().min(2),
  birth_date: z.string().optional(),
  identity_number: z.string().optional(),
  hmo: z.string().optional(),
  allergies: z.string().optional(),
  regular_medications: z.string().optional(),
  mother_identity_number: z.string().optional(),
  father_identity_number: z.string().optional(),
  photo_consent: z.boolean().optional(),
  system_consent: z.boolean().optional()
});

export const parentSchema = z.object({
  garden_id: z.string().uuid(),
  full_name: z.string().min(2),
  identity_number: z.string().optional(),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  address: z.string().optional()
});

export const staffSchema = z.object({
  garden_id: z.string().uuid(),
  full_name: z.string().min(2),
  role_title: z.string().min(2),
  identity_number: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  class_group: z.string().optional(),
  start_date: z.string().optional()
});

export const teacherSchema = z.object({
  id: z.string().uuid(),
  garden_id: z.string().uuid(),
  title: z.string().default("גננת"),
  class_group: z.string().optional()
});

export const inspectorSchema = z.object({
  id: z.string().uuid(),
  service_cities: z.array(z.string()).default([]),
  certification_notes: z.string().optional()
});

export const leadSchema = z.object({
  garden_id: z.string().uuid().optional(),
  lead_type: z.enum(["parent", "garden", "inspector"]),
  parent_name: z.string().optional(),
  child_name: z.string().optional(),
  child_age: z.string().optional(),
  garden_name: z.string().optional(),
  owner_name: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  manager_name: z.string().optional(),
  age_groups: z.array(z.string()).optional(),
  capacity: z.number().int().min(0).optional(),
  experience: z.string().optional(),
  certifications: z.string().optional(),
  status: z.string().optional(),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  notes: z.string().optional()
});

export const taskSchema = z.object({
  garden_id: z.string().uuid().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  due_at: z.string().optional()
});

export const complaintSchema = z.object({
  garden_id: z.string().uuid(),
  parent_id: z.string().uuid().optional(),
  subject: z.string().min(2),
  description: z.string().min(5),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  urgent: z.boolean().default(false)
});

export const messageSchema = z.object({
  garden_id: z.string().uuid().optional(),
  recipient_id: z.string().uuid().optional(),
  subject: z.string().min(2),
  body: z.string().min(1)
});

export const inspectionSchema = z.object({
  garden_id: z.string().uuid(),
  inspector_id: z.string().uuid(),
  form_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
  gps_verified: z.boolean().default(false)
});

export const inspectionFormSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  framework_type: z.string().default("mixed"),
  active: z.boolean().default(true),
  frequency_months: z.number().int().min(1).default(1)
});

export const inspectionFormQuestionSchema = z.object({
  form_id: z.string().uuid(),
  category: z.string().min(2),
  question_text: z.string().min(2),
  question_type: z.enum(["score_1_10", "boolean", "photo_upload", "document_upload", "text_note"]).default("score_1_10"),
  required: z.boolean().default(true),
  critical: z.boolean().default(false),
  weight: z.number().positive().default(1),
  min_score: z.number().int().min(1).max(10).default(1),
  max_score: z.number().int().min(1).max(10).default(10),
  violation_threshold: z.number().int().min(1).max(10).default(4),
  requires_note: z.boolean().default(false),
  requires_photo: z.boolean().default(false),
  requires_document: z.boolean().default(false),
  help_text: z.string().optional(),
  options: z.record(z.string(), z.unknown()).default({}),
  sort_order: z.number().int().default(0)
});

export const documentSchema = z.object({
  garden_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  child_id: z.string().uuid().optional(),
  name: z.string().min(2),
  document_type: z.string().min(2),
  file_url: z.string().url(),
  expires_at: z.string().optional()
});

export const attendanceSchema = z.object({
  garden_id: z.string().uuid(),
  child_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  status: z.enum(["present", "absent", "sick", "late", "left_early", "not_updated"]),
  note: z.string().optional()
});

export const cameraStreamSchema = z.object({
  garden_id: z.string().uuid(),
  name: z.string().min(2),
  area: z.string().min(2),
  camera_type: z.string().optional(),
  protocol: z.string().default("RTSP"),
  active: z.boolean().default(true)
});

export const parentCameraPermissionSchema = z.object({
  garden_id: z.string().uuid(),
  parent_id: z.string().uuid(),
  child_id: z.string().uuid().optional(),
  camera_stream_id: z.string().uuid(),
  allowed: z.boolean().default(true),
  reason: z.string().optional(),
  valid_until: z.string().optional()
});

export const cameraSnapshotSchema = z.object({
  garden_id: z.string().uuid(),
  camera_stream_id: z.string().uuid().optional(),
  storage_bucket: z.string().default("camera-snapshots"),
  storage_path: z.string().min(2),
  source: z.string().default("manual"),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const restrictedAreaSchema = z.object({
  garden_id: z.string().uuid(),
  camera_stream_id: z.string().uuid().optional(),
  name: z.string().min(2),
  polygon: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
  active: z.boolean().default(true)
});

export const aiEventSchema = z.object({
  garden_id: z.string().uuid(),
  camera_stream_id: z.string().uuid().optional(),
  event_type: z.string().min(2),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  screenshot_url: z.string().url().optional(),
  confidence: z.number().optional()
});

export const procedureSchema = z.object({
  title: z.string().min(2),
  procedure_type: z.string().min(2),
  body: z.string().min(5),
  required_for_framework: z.string().default("all"),
  active: z.boolean().default(true),
  requires_acknowledgement: z.boolean().default(true)
});

export const campaignSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(5),
  audience: z.record(z.string(), z.unknown()).default({ roles: ["manager"] }),
  starts_at: z.string().optional(),
  ends_at: z.string().optional()
});

export const reportExportSchema = z.object({
  garden_id: z.string().uuid().optional(),
  report_type: z.string().min(2),
  format: z.enum(["pdf", "xlsx", "csv"]),
  filters: z.record(z.string(), z.unknown()).default({})
});

export const emergencyTaskSchema = z.object({
  garden_id: z.string().uuid().optional(),
  title: z.string().min(2),
  description: z.string().min(5),
  due_at: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("critical")
});

export const staffShiftSchema = z.object({
  staff_id: z.string().uuid(),
  garden_id: z.string().uuid(),
  shift_date: z.string(),
  planned_start: z.string().optional(),
  planned_end: z.string().optional()
});

export const staffCertificateSchema = z.object({
  staff_id: z.string().uuid(),
  garden_id: z.string().uuid(),
  certificate_type: z.string().min(2),
  file_url: z.string().url().optional(),
  issued_at: z.string().optional(),
  expires_at: z.string().optional()
});

export const gpsAttendanceSchema = z.object({
  staff_id: z.string().uuid(),
  garden_id: z.string().uuid(),
  action: z.enum(["check_in", "check_out"]),
  gps_lat: z.number(),
  gps_lng: z.number()
});

export const pickupConfirmationSchema = z.object({
  garden_id: z.string().uuid(),
  child_id: z.string().uuid(),
  parent_id: z.string().uuid().optional(),
  picked_up_by_name: z.string().min(2),
  authorized: z.boolean(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional()
});
