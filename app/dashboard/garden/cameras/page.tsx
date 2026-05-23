import { Camera, CheckCircle2, Eye, KeyRound, LockKeyhole, RadioTower, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

const setupSteps = ["בחירת מערכת", "פרטי חיבור", "בדיקת חיבור", "תצוגה מקדימה", "הרשאות", "שמירה"];

export default async function CameraSetupWizardPage() {
  await requireRole(["manager"]);
  return (
    <DashboardShell role="manager" title="ניהול מצלמות">
      <div className="dashboard-hero-card"><div><p className="eyebrow">Camera Setup Wizard</p><h1>חיבור מצלמות בלי לחשוף DVR להורים.</h1><p>המערכת משתמשת בשכבת Video Gateway, Token זמני, Watermark ולוג צפייה מלא.</p></div><span className="pill good"><LockKeyhole size={15} /> RTSP נשאר מאובטח</span></div>
      <section className="sectionless-card wizard-form"><div className="stepper">{setupSteps.map((step, index) => <span key={step}><b>{index + 1}</b>{step}</span>)}</div><div className="grid cols-2"><article className="card feature-card"><Camera className="feature-icon" /><h2>1. סוג מערכת</h2><div className="choice-grid"><button>DVR</button><button>NVR</button><button>IP Camera</button><button>Manual RTSP</button><button>ONVIF Discovery</button></div></article><article className="card feature-card"><ShieldCheck className="feature-icon" /><h2>מה צריך מהגן?</h2><p>כתובת DVR/NVR פנימית, פורט, משתמש, סיסמה, ערוץ מצלמה ונתיב RTSP אם קיים. הפרטים מוצפנים ואינם נחשפים להורים.</p></article></div><form className="form"><div className="form-grid"><label>שם מערכת<input placeholder="DVR ראשי" /></label><label>IP / Host<input placeholder="192.168.1.20" /></label><label>פורט<input placeholder="554" /></label><label>שם משתמש<input /></label><label>סיסמה<input type="password" /></label><label>פרוטוקול<select><option>RTSP</option><option>ONVIF</option><option>HLS דרך Gateway</option></select></label><label>אזור<select><option>כיתה</option><option>חצר</option><option>כניסה</option><option>חדר אוכל</option></select></label><label>כיתה / קבוצת גיל<input placeholder="בוגרים 3-4" /></label><label>צפיית הורים<select><option>לא</option><option>כן, לפי חלון שעות</option></select></label></div><div className="quick-actions-grid"><button className="quick-action" type="button"><RadioTower /> <strong>בדיקת חיבור</strong><span>בודק זמינות, latency וזרם פעיל.</span></button><button className="quick-action" type="button"><Eye /> <strong>תצוגה מקדימה</strong><span>Preview דרך Gateway בלבד.</span></button><button className="quick-action" type="button"><KeyRound /> <strong>הקצאת הרשאות</strong><span>הורים לפי כיתה, מנהל, פקח ואדמין.</span></button></div><button className="button primary large" type="button">שמירת מצלמה</button></form></section>
      <section className="grid cols-4 dashboard-kpis"><div className="card health-card"><CheckCircle2 /> אונליין</div><div className="card health-card warn">Black frame</div><div className="card health-card warn">Frozen</div><div className="card health-card bad">Covered / Offline</div></section>
    </DashboardShell>
  );
}
