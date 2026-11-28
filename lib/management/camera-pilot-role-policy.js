import "server-only";
import { isCapabilityAllowed } from "@/lib/domain/capability-policy-engine";
import { canParentViewCamera } from "@/lib/domain/parent-camera-access";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { parseViewingWindow } from "@/lib/domain/video-streaming";
import { guardianChildIds } from "@/lib/management/family-link";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";
import { getMfaGateStatus } from "@/lib/security/identity-security";

export async function canUseSyntheticCameraPilot(client, profile, claims, camera, siteId) {
  if (profile.active !== true || camera.active !== true || camera.observer_site_id !== siteId ||
      !parseViewingWindow(camera).allowed) return false;
  const room = camera.class_group ?? camera.age_group ?? camera.camera_zone_label;
  if (profile.role === "staff") {
    if (camera.staff_view_allowed !== true || !room) return false;
    const staff = await resolveStaffEmploymentContext(profile);
    return staff.available && staff.activeEmployment?.garden_id === camera.garden_id &&
      staff.activeEmployment.classroom_names.includes(room);
  }
  if (profile.role !== "parent" || camera.parent_view_allowed !== true || claims.aal !== "aal2") return false;
  const policy = await client.from("parent_camera_policies")
    .select("viewing_enabled,approved_camera_ids,viewing_hours,restricted_hours,metadata")
    .eq("garden_id", camera.garden_id).eq("status", "active").maybeSingle();
  const approved = policy.data;
  if (policy.error || approved?.viewing_enabled !== true || !approved.approved_camera_ids?.includes(camera.id) ||
      !parseViewingWindow(approved).allowed ||
      Object.keys(approved.restricted_hours ?? {}).length !== 0) return false;
  if (!await isCapabilityAllowed(client, "gan_batuach", "parent_viewing", {
    legalReviewApproved: approved.metadata?.legal_review_approved === true ||
      approved.metadata?.external_legal_review_status === "approved",
    consentConfirmed: approved.metadata?.parent_consent_ready === true
  })) return false;
  if (!(await getMfaGateStatus(client, profile, "camera_view")).allowed ||
      !(await canParentViewCamera(client, profile.id, camera.id)).allowed) return false;

  const files = await guardianChildIds(client, profile.id);
  if (!files.length || files.length > 100) return false;
  const enrollment = await client.from("child_kindergarten_enrollments").select("child_id")
    .eq("garden_id", camera.garden_id).eq("status", "active").in("permanent_child_file_id", files).limit(101);
  if (enrollment.error || !enrollment.data?.length || enrollment.data.length > 100) return false;
  const ids = enrollment.data.map(row => row.child_id).filter(Boolean);
  if (!ids.length) return false;
  const attendance = await client.from("attendance").select("child_id")
    .eq("garden_id", camera.garden_id).eq("attendance_date", israelTodayDateKey())
    .in("child_id", ids).eq("status", "present").not("check_in_at", "is", null).is("check_out_at", null).limit(101);
  if (attendance.error || !attendance.data?.length || attendance.data.length > 100) return false;
  if (!room) return true;
  const children = await client.from("children").select("classroom,age_group")
    .eq("garden_id", camera.garden_id).in("id", attendance.data.map(row => row.child_id)).limit(101);
  return !children.error && children.data?.some(child => child.classroom === room || child.age_group === room) === true;
}
