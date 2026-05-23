"use client";
import { useState } from "react";
import { CheckCircle2, ClipboardPlus, EyeOff } from "lucide-react";

export function AiEventActions() {
  const [status, setStatus] = useState("ממתין לטיפול");
  return <div><div className="actions"><button className="button primary" type="button" onClick={() => setStatus("נוצרה משימת טיפול לאירוע AI") }><ClipboardPlus size={16} /> יצירת משימה</button><button className="button" type="button" onClick={() => setStatus("האירוע סומן כטופל") }><CheckCircle2 size={16} /> טופל</button><button className="button" type="button" onClick={() => setStatus("האירוע סומן כזיהוי שגוי ונכנס לפידבק") }><EyeOff size={16} /> זיהוי שגוי</button></div><div className="success-screen compact-success"><strong>{status}</strong><small>בשלב ללא Gateway הפעולה נשמרת כסטטוס UI/חוזה API ולא כניתוח Live.</small></div></div>;
}
