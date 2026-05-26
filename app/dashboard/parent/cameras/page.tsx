import { Camera, ShieldCheck } from "lucide-react";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const parentRes = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const parentId = (parentRes.data as any)?.id;
  const permissionsRes = parentId ? await supabase.from("parent_camera_permissions" as any).select("id, allowed, valid_from, valid_until, reason, camera_streams(id, name, area, camera_type, protocol, status, parent_view_allowed, hls_playback_url, webrtc_playback_url, last_health_check_at, gardens(name))").eq("parent_id", parentId).eq("allowed", true).limit(30) : { data: [] };
  const rows = (permissionsRes.data ?? []) as any[];
  const gatewayConnected = Boolean(process.env.VIDEO_GATEWAY_URL);
  return <DashboardShell role="parent" title="צפייה במצלמות"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">לייב מורשה</p><h1>תצפיתן דיגיטלי - צפייה במצלמות.</h1><p>המערכת לא חושפת DVR/RTSP להורים. צפייה פעילה דורשת Video Gateway או Sample HLS מאושר, Token זמני ולוג צפייה.</p></div><span className={gatewayConnected ? "pill good" : "pill warn"}>{gatewayConnected ? "Gateway מחובר" : "ממתין ל-Gateway"}</span></div><section className="grid cols-3 dashboard-panels"><article className="card action-panel"><ShieldCheck /><h2>פרטיות</h2><p>רק מצלמות שהגן אישר עבור הכיתה/הילד יוצגו כאן.</p></article><article className="card action-panel"><Camera /><h2>Watermark ולוג</h2><p>כל צפייה נשמרת עם משתמש, זמן, מכשיר וכתובת IP כאשר Gateway פעיל.</p></article><article className="card action-panel"><h2>חלונות צפייה</h2><p>הגן יכול להגדיר שעות צפייה ותוקף הרשאה לכל מצלמה.</p></article></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין הרשאת צפייה</strong><span>כאשר מנהלת הגן תאשר צפיית הורים למצלמה רלוונטית, היא תופיע כאן. אין גישה למצלמות של גנים אחרים.</span></div> : <div className="camera-playback-grid">{rows.map((row) => <CameraPlaybackCard camera={row.camera_streams ?? {}} parentId={parentId} key={row.id} />)}</div>}</section></DashboardShell>;
}
