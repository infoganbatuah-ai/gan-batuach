import { Bot, Camera, CheckCircle2, Eye, KeyRound, LockKeyhole, RadioTower, ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react";

const steps = ["Add camera source", "Choose DVR/NVR/IP/RTSP/ONVIF", "Enter connection", "Test connection", "Assign classroom", "Parent permissions", "Enable AI", "Choose detections", "Thresholds", "Test event", "Health status"];
const detections = ["Violence", "Child alone", "Restricted area", "Cry detection", "Staff absence", "Overcrowding", "Fall detection", "No movement"];

export function CameraAiWizard({ gatewayConnected, roleLabel }: { gatewayConnected: boolean; roleLabel: string }) {
  return (
    <>
      <div className="dashboard-hero-card">
        <div><p className="eyebrow">Camera & AI Setup Wizard</p><h1>חיבור מצלמות ותצפיתן AI בצורה ברורה ומבוקרת.</h1><p>המסך מסביר את תהליך החיבור בלי להציג RTSP להורים ובלי לטעון ש־AI פעיל לפני שיש Video Gateway מחובר.</p></div>
        <span className={gatewayConnected ? "pill good" : "pill warn"}><LockKeyhole size={15} /> {gatewayConnected ? "Video gateway connected" : "Video gateway not connected yet"}</span>
      </div>
      {!gatewayConnected ? <div className="error-banner"><strong>Video gateway not connected yet</strong><p>כדי להפעיל סטרימינג ובדיקות AI יש להגדיר את המשתנה VIDEO_GATEWAY_URL ולחבר שרת Gateway שממיר RTSP/ONVIF ל־HLS/WebRTC.</p></div> : null}
      <section className="sectionless-card wizard-form"><div className="stepper expanded">{steps.map((step, index) => <span key={step}><b>{index + 1}</b>{step}</span>)}</div>
        <div className="grid cols-2">
          <article className="card feature-card"><Camera className="feature-icon" /><h2>1. מקור מצלמה</h2><div className="choice-grid"><button>DVR</button><button>NVR</button><button>IP Camera</button><button>Manual RTSP</button><button>ONVIF Discovery</button></div></article>
          <article className="card feature-card"><ShieldCheck className="feature-icon" /><h2>הגנת פרטיות</h2><p>ה־DVR אינו נחשף להורים. צפייה מתבצעת עם Session זמני, Watermark ולוג צפייה.</p></article>
        </div>
        <form className="form"><div className="form-grid"><label>שם מקור<input placeholder="DVR ראשי" /></label><label>גן / כיתה<input placeholder="גן דוגמה · כיתת בוגרים" /></label><label>IP / Host<input placeholder="192.168.1.20" /></label><label>פורט<input placeholder="554" /></label><label>משתמש<input /></label><label>סיסמה<input type="password" /></label><label>פרוטוקול<select><option>RTSP</option><option>ONVIF</option><option>HLS דרך Gateway</option><option>WebRTC דרך Gateway</option></select></label><label>אזור<select><option>כיתה</option><option>חצר</option><option>כניסה</option><option>מטבח</option></select></label><label>צפיית הורים<select><option>לא מאושר</option><option>מאושר לפי כיתה וחלון שעות</option></select></label><label>חלון צפייה<input placeholder="08:30-12:00" /></label></div>
          <h3>תצפיתן AI</h3><div className="choice-grid detection-grid">{detections.map((item) => <label key={item}><input type="checkbox" /> {item}</label>)}</div>
          <div className="form-grid"><label>סף התראה<input type="number" min="0" max="1" step="0.05" placeholder="0.80" /></label><label>Cooldown בשניות<input type="number" min="10" placeholder="120" /></label><label>חומרת ברירת מחדל<select><option>נמוך</option><option>בינוני</option><option>גבוה</option><option>קריטי</option></select></label></div>
          <div className="quick-actions-grid"><button className="quick-action" type="button"><RadioTower /> <strong>בדיקת חיבור</strong><span>{gatewayConnected ? "בדיקת Gateway, latency וזרם." : "דורש VIDEO_GATEWAY_URL."}</span></button><button className="quick-action" type="button"><Eye /> <strong>Preview</strong><span>תצוגה דרך Gateway בלבד.</span></button><button className="quick-action" type="button"><Bot /> <strong>בדיקת אירוע AI</strong><span>יוצר אירוע בדיקה רק אם Gateway מחובר.</span></button><button className="quick-action" type="button"><KeyRound /> <strong>הרשאות</strong><span>הורים, {roleLabel}, פקח ואדמין.</span></button></div>
        </form>
      </section>
      <section className="grid cols-4 dashboard-kpis"><div className="card health-card"><CheckCircle2 /> Camera online</div><div className="card health-card bad"><ShieldAlert /> Camera offline</div><div className="card health-card warn"><Bot /> AI observer disabled</div><div className="card health-card"><SlidersHorizontal /> Parent viewing allowed / not allowed</div></section>
    </>
  );
}
