import { Camera, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const parentRes = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const parentId = (parentRes.data as any)?.id;
  const permissionsRes = parentId ? await supabase.from("parent_camera_permissions" as any).select("id, allowed, valid_from, valid_until, reason, camera_streams(id, name, area, status, parent_view_allowed, ai_enabled, last_health_check_at, gardens(name))").eq("parent_id", parentId).eq("allowed", true).limit(30) : { data: [] };
  const rows = (permissionsRes.data ?? []) as any[];
  const gatewayConnected = Boolean(process.env.VIDEO_GATEWAY_URL);
  return <DashboardShell role="parent" title="צפייה במצלמות"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">לייב מורשה</p><h1>צפייה במצלמות לפי הרשאת הילד והכיתה.</h1><p>המערכת לא חושפת DVR/RTSP להורים. צפייה פעילה דורשת Video Gateway, Token זמני ולוג צפייה.</p></div><span className={gatewayConnected ? "pill good" : "pill warn"}>{gatewayConnected ? "Gateway מחובר" : "ממתין ל-Gateway"}</span></div><section className="grid cols-3 dashboard-panels"><article className="card action-panel"><ShieldCheck /><h2>פרטיות</h2><p>רק מצלמות שהגן אישר עבור הכיתה/הילד יוצגו כאן.</p></article><article className="card action-panel"><Camera /><h2>Watermark ולוג</h2><p>כל צפייה נשמרת עם משתמש, זמן, מכשיר וכתובת IP כאשר Gateway פעיל.</p></article><article className="card action-panel"><h2>חלונות צפייה</h2><p>הגן יכול להגדיר שעות צפייה ותוקף הרשאה לכל מצלמה.</p></article></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין מצלמות מורשות כרגע</strong><span>כאשר מנהלת הגן תאשר צפיית הורים למצלמה רלוונטית, היא תופיע כאן. אם ה-Gateway עדיין לא מחובר, המצלמה תוצג כממתינה.</span></div> : <div className="procedure-list">{rows.map((row) => { const camera = row.camera_streams ?? {}; return <article className="card procedure-card" key={row.id}><div><span className={camera.status === "connected" ? "pill good" : "pill warn"}>{camera.status ?? "pending_gateway"}</span><h3>{camera.name ?? "מצלמה"}</h3><p>{camera.gardens?.name ?? "גן"} · {camera.area ?? "אזור לא הוגדר"}</p><small>תוקף: {row.valid_until ? new Date(row.valid_until).toLocaleDateString("he-IL") : "לפי הגדרות הגן"}</small></div><div className="procedure-meta"><span className={gatewayConnected && camera.status === "connected" ? "pill good" : "pill warn"}>{gatewayConnected ? "ניתן להפיק Session" : "Live בהמתנה"}</span><span className="pill">{camera.ai_enabled ? "AI פעיל בהגדרות" : "AI כבוי"}</span></div></article>; })}</div>}</section></DashboardShell>;
}
