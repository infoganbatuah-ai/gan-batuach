import { Bot, BrainCircuit, Camera, Ear, Eye, RadioTower, ShieldCheck, Video } from "lucide-react";

const pipeline = [
  { icon: Camera, title: "מקורות וידאו", body: "DVR, NVR, מצלמות IP, RTSP ו-ONVIF נשמרים כמקורות מאובטחים לפי גן." },
  { icon: RadioTower, title: "Video Gateway", body: "שכבת שרת חיצונית ממירה RTSP/ONVIF ל-HLS/WebRTC בלי לחשוף כתובות מצלמה למשתמשים." },
  { icon: Video, title: "Playback מאובטח", body: "הצפייה בדפדפן מתוכננת לעבוד עם Token זמני, Watermark, חלונות צפייה ולוג צפייה מלא." },
  { icon: BrainCircuit, title: "AI Gateway", body: "מנוע עתידי מקבל פריימים/אודיו מה-Gateway ומחזיר אירועים מובנים בלבד." }
];

const detectionBlocks = [
  { icon: Eye, title: "תנועה וראייה", items: ["נפילה", "תנועה חריגה", "צפיפות", "ילד מחוץ לאזור", "מצלמה מכוסה/קפואה"] },
  { icon: Ear, title: "קול ושפה", items: ["בכי חריג", "צעקות", "הסלמת ויכוח", "מילות אלימות בעברית", "צלילי מצוקה"] },
  { icon: Bot, title: "זיהוי ונוכחות", items: ["זיהוי פנים לנוכחות", "היעדר צוות", "ילד לבד", "חוסר תנועה חריג", "התאמת ילד לכיתה"] }
];

export function DigitalObserverArchitecture({ aiConnected, videoConnected }: { aiConnected: boolean; videoConnected: boolean }) {
  return (
    <section className="digital-observer-architecture">
      <div className="section-heading">
        <h2><Bot size={22} /> ארכיטקטורת התצפיתן הדיגיטלי</h2>
        <p>המערכת מכינה את כל החוזים, ההגדרות וההרשאות לחיבור Live עתידי, בלי להציג שהניתוח פעיל לפני חיבור Gateway אמיתי.</p>
      </div>
      <div className="observer-status-grid">
        <div className={videoConnected ? "observer-status good" : "observer-status warn"}><ShieldCheck /> Video Gateway: {videoConnected ? "מחובר" : "ממתין לחיבור"}</div>
        <div className={aiConnected ? "observer-status good" : "observer-status warn"}><BrainCircuit /> AI Gateway: {aiConnected ? "מחובר" : "ממתין לחיבור"}</div>
      </div>
      <div className="observer-pipeline">
        {pipeline.map((step, index) => <article className="card observer-step" key={step.title}><step.icon /><b>{index + 1}</b><h3>{step.title}</h3><p>{step.body}</p></article>)}
      </div>
      <div className="grid cols-3 dashboard-panels">
        {detectionBlocks.map((block) => <article className="card action-panel observer-detection" key={block.title}><block.icon /><h3>{block.title}</h3>{block.items.map((item) => <span className="pill" key={item}>{item}</span>)}</article>)}
      </div>
      <article className="card ai-assistant-concept">
        <div><Bot /><h3>עוזר AI פנימי למפעילי המערכת</h3></div>
        <p>שכבת Assistant עתידית תוכל לסכם אירועים, להציע משימות תיקון, לנסח הודעות להורים ולהסביר חריגים לפקח. בשלב זה נשמרת רק הארכיטקטורה וה-UI, ללא החלטות אוטומטיות וללא טענה לפעילות Live.</p>
      </article>
    </section>
  );
}
