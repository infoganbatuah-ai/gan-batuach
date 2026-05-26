import { Camera, ShieldCheck } from "lucide-react";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

type GardenGroup = {
  id: string;
  name: string;
  cameras: any[];
};

export default async function Page() {
  const { profile } = await requireRole(["parent"]);
  const userScopedSupabase = await createClient();
  const supabase = isAdminClientConfigured() ? createAdminClient() : userScopedSupabase;
  const parentRes = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const parentId = (parentRes.data as any)?.id;
  const childrenRes = parentId
    ? await supabase.from("children" as any).select("id, full_name, garden_id, gardens(id, name, city)").eq("primary_parent_id", parentId)
    : { data: [] };
  const children = (childrenRes.data ?? []) as any[];
  const gardenIds = Array.from(new Set(children.map((child) => child.garden_id).filter(Boolean)));
  const camerasRes = gardenIds.length
    ? await supabase
        .from("camera_streams" as any)
        .select("id, garden_id, kindergarten_id, name, area, camera_type, source_type, protocol, status, active, parent_view_allowed, parent_viewing_allowed, hls_playback_url, sample_hls_url, webrtc_playback_url, last_health_check_at, viewing_hours, gardens(name, city)")
        .in("garden_id", gardenIds)
        .eq("active", true)
        .or("parent_view_allowed.eq.true,parent_viewing_allowed.eq.true")
        .limit(60)
    : { data: [] };
  const cameras = (camerasRes.data ?? []) as any[];
  const groups = gardenIds.map((gardenId) => {
    const child = children.find((item) => item.garden_id === gardenId);
    return {
      id: gardenId,
      name: child?.gardens?.name ?? cameras.find((camera) => camera.garden_id === gardenId)?.gardens?.name ?? "גן ילדים",
      cameras: cameras.filter((camera) => camera.garden_id === gardenId || camera.kindergarten_id === gardenId)
    } satisfies GardenGroup;
  }).filter((group) => group.cameras.length > 0);
  const gatewayConnected = Boolean(process.env.VIDEO_GATEWAY_URL);

  return <DashboardShell role="parent" title="מצלמות הגן"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">צפייה מורשית בלבד</p><h1>מצלמות הגן.</h1><p>הורה רואה רק מצלמות של גני הילדים של ילדיו ורק מצלמות שהגן סימן כמותרות לצפיית הורים. RTSP, שם משתמש וסיסמאות לא נשלחים לדפדפן.</p></div><span className={gatewayConnected ? "pill good" : "pill warn"}>{gatewayConnected ? "Gateway מחובר" : "Sample HLS / Gateway"}</span></div><section className="grid cols-3 dashboard-panels"><article className="card action-panel"><ShieldCheck /><h2>פרטיות</h2><p>אין גישה למצלמות של גנים אחרים או למצלמות שלא אושרו להורים.</p></article><article className="card action-panel"><Camera /><h2>Token זמני</h2><p>כל פתיחת צפייה יוצרת Session זמני ומתועד.</p></article><article className="card action-panel"><h2>חלונות צפייה</h2><p>הגן יכול להגדיר שעות ותוקף הרשאה לכל מצלמה.</p></article></section><section className="dashboard-section">{groups.length === 0 ? <div className="empty-state"><strong>אין מצלמות זמינות לצפייה כרגע</strong><span>כאשר הגן יאפשר צפיית הורים במצלמה של גן הילדים של ילדך, היא תופיע כאן. אין חשיפה למצלמות אחרות או לפרטי DVR.</span></div> : groups.map((group) => <section className="dashboard-section" key={group.id}><div className="section-heading"><h2>{group.name}</h2><p>{group.cameras.length} מצלמות מאושרות לצפיית הורים.</p></div><div className="camera-playback-grid">{group.cameras.map((camera) => <CameraPlaybackCard camera={camera} parentId={parentId} key={camera.id} />)}</div></section>)}</section></DashboardShell>;
}
