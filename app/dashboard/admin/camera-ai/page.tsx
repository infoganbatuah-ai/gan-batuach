import Link from "next/link";
import { Bot, Camera } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["admin"]);
  return <DashboardShell role="admin" title="מצלמות ותצפיתן"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Camera + AI Hub</p><h1>מרכז מעבר למצלמות ולתצפיתן הדיגיטלי.</h1><p>עמוד ייעודי שמסביר את שני המודולים ומוביל למסכי הניהול האמיתיים, בלי להפנות ל-API או למסך משוכפל.</p></div><span className="pill good">מרכז פעיל</span></div><section className="grid cols-2 dashboard-panels"><article className="card action-panel"><Camera /><h2>מצלמות ו-Gateway</h2><p>הוספת DVR/NVR/IP/RTSP/ONVIF, שמירה כממתין Gateway, הרשאות הורים ובריאות שידור.</p><Link className="button primary" href="/dashboard/admin/cameras">ניהול מצלמות</Link></article><article className="card action-panel"><Bot /><h2>תצפיתן AI</h2><p>הגדרת סוגי זיהוי, ספים, התראות וניהול אירועים קיימים. Live דורש AI Gateway.</p><div className="actions"><Link className="button primary" href="/dashboard/admin/ai-observer">הגדרות AI</Link><Link className="button secondary" href="/dashboard/admin/ai-events">אירועי AI</Link></div></article></section></DashboardShell>;
}
